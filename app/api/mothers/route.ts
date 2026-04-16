import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
  ScopedUserPayload,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * GET /api/mothers
 * Retrieve mothers with automatic tenant scoping and role-based filtering
 * PROTECTED - Requires valid JWT token with clinical role or admin
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Own facility scope
 * - DHO, ORG_ADMIN, HOSPITAL_ADMIN: Hospital/organization scope
 * - CHW: Assigned mothers only (chwId match)
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Query parameters:
 * - search: Search by fullName or phone (partial match, min 2 chars, optional)
 * - district: Filter by districtId (optional)
 * - facilityId: Filter by facilityId (optional)
 * - consentAccepted: Filter by consent status (true|false, optional)
 * - skip: Pagination offset (default: 0)
 * - take: Number of records to return (default: 20, max: 100)
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 42,
 *       "name": "Jane Doe",
 *       "phone": "+256701234567",
 *       "consentStatus": true,
 *       "village": "Bukoto",
 *       "district": "Kampala",
 *       "facilityName": "Mulago Hospital",
 *       "createdByUsername": "nurse_1",
 *       "createdAt": "2026-04-01T10:30:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 156,
 *     "returned": 20,
 *     "skip": 0,
 *     "take": 20
 *   }
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Insufficient permissions"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - no token provided' },
        { status: 401 }
      );
    }

    // ========================================================================
    // 2. CHECK ROLE PERMISSIONS
    // ========================================================================
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'CHW', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to access mothers' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE TENANT SCOPE
    // ========================================================================
    try {
      assertValidTenantScope(user as ScopedUserPayload);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 4. PARSE & VALIDATE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl;

    // Search filter (optional)
    const search = searchParams.get('search');
    if (search && search.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search term must be at least 2 characters' },
        { status: 422 }
      );
    }

    // District filter (optional)
    const districtParam = searchParams.get('district');
    let districtId: number | undefined;
    if (districtParam) {
      districtId = parseInt(districtParam, 10);
      if (isNaN(districtId) || districtId <= 0) {
        return NextResponse.json(
          { success: false, error: 'District ID must be a positive integer' },
          { status: 422 }
        );
      }
    }

    // FacilityId filter (optional)
    const facilityIdParam = searchParams.get('facilityId');
    let facilityId: number | undefined;
    if (facilityIdParam) {
      facilityId = parseInt(facilityIdParam, 10);
      if (isNaN(facilityId) || facilityId <= 0) {
        return NextResponse.json(
          { success: false, error: 'Facility ID must be a positive integer' },
          { status: 422 }
        );
      }
    }

    // Consent filter (optional)
    const consentAcceptedParam = searchParams.get('consentAccepted');
    let consentAccepted: boolean | undefined;
    if (consentAcceptedParam) {
      if (!['true', 'false'].includes(consentAcceptedParam)) {
        return NextResponse.json(
          { success: false, error: 'consentAccepted must be true or false' },
          { status: 422 }
        );
      }
      consentAccepted = consentAcceptedParam === 'true';
    }

    // Pagination parameters
    let skip = 0;
    let take = 20;

    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
      if (isNaN(skip)) {
        return NextResponse.json(
          { success: false, error: 'skip must be a non-negative integer' },
          { status: 422 }
        );
      }
    }

    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = parseInt(takeParam, 10);
      if (isNaN(take) || take < 1) {
        return NextResponse.json(
          { success: false, error: 'take must be a positive integer' },
          { status: 422 }
        );
      }
      take = Math.min(take, 100); // Cap at 100
    }

    // ========================================================================
    // 5. BUILD WHERE CLAUSE WITH TENANT SCOPING
    // ========================================================================
    let whereClause: any = getTenantScopingFilter(user as ScopedUserPayload);

    // CHW role: only assigned mothers
    if (user.role === 'CHW') {
      whereClause.chwId = user.id;
    }

    // Add optional filters
    if (districtId !== undefined) {
      whereClause.districtId = districtId;
    }

    if (facilityId !== undefined) {
      whereClause.facilityId = facilityId;
    }

    if (consentAccepted !== undefined) {
      whereClause.consentAccepted = consentAccepted;
    }

    // Always exclude soft-deleted mothers
    whereClause.deletedAt = null;

    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ========================================================================
    // 6. QUERY MOTHERS WITH RELATIONS
    // ========================================================================
    const [mothers, totalCount] = await Promise.all([
      db.mother.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          phone: true,
          consentAccepted: true,
          village: true,
          district: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
          registeredBy: { select: { id: true, username: true } },
          createdAt: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.mother.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. FORMAT RESPONSE
    // ========================================================================
    const formattedMothers = mothers.map((mother) => ({
      id: mother.id,
      name: mother.fullName,
      phone: mother.phone,
      consentStatus: mother.consentAccepted,
      village: mother.village,
      district: mother.district?.name,
      facilityName: mother.facility?.name,
      createdByUsername: mother.registeredBy?.username,
      createdAt: mother.createdAt,
    }));

    // ========================================================================
    // 8. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'READ',
      resource: 'Mother',
      resourceId: 0, // No specific resource for list operation
      changesSummary: {
        filters: {
          search: search || 'none',
          district: districtId || 'all',
          facilityId: facilityId || 'all',
          consentAccepted: consentAccepted ?? 'all',
        },
        resultCount: mothers.length,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: formattedMothers,
        pagination: {
          total: totalCount,
          returned: mothers.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/mothers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mothers
 * Create a new mother in the system
 * PROTECTED - Requires valid JWT token (DOCTOR, NURSE, MIDWIFE, HOSPITAL_ADMIN, SYSTEM_ADMIN)
 *
 * Request body:
 * {
 *   "fullName": "Jane Doe" (required, 2-100 chars),
 *   "phone": "0701234567" or "+256701234567" (required, unique),
 *   "dob": "1990-05-15" (optional, ISO date string),
 *   "village": "Bukoto" (optional),
 *   "districtId": 1 (required, positive integer),
 *   "facilityId": 5 (required, positive integer),
 *   "chwId": 10 (required, positive integer),
 *   "consentAccepted": true (required, must be true)
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Mother created successfully",
 *   "data": {
 *     "id": 123,
 *     "fullName": "Jane Doe",
 *     "phone": "0701234567",
 *     "dob": "1990-05-15",
 *     "village": "Bukoto",
 *     "districtId": 1,
 *     "facilityId": 5,
 *     "consentAccepted": true,
 *     "consentDate": "2026-04-16T10:30:00.000Z",
 *     "district": { "id": 1, "name": "Kampala" },
 *     "facility": { "id": 5, "name": "Central Hospital" },
 *     "chw": { "id": 10, "name": "James Mutua" }
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Full name must be between 2 and 100 characters"
 * }
 *
 * Response on duplicate phone (409):
 * {
 *   "success": false,
 *   "error": "Phone number is already registered"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      throw new UnauthorizedError('No token provided');
    }

    // Allow clinical staff, CHW, and admins to create mothers
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'CHW', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError('Only clinical staff and admins can create mothers');
    }

    assertValidTenantScope(user as ScopedUserPayload);

    // ========================================================================
    // 2. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { fullName, phone, dob, village, districtId, facilityId, chwId, consentAccepted } =
      body;

    // Validate fullName
    if (!fullName || typeof fullName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Full name is required and must be a string' },
        { status: 422 }
      );
    }

    const trimmedFullName = fullName.trim();
    if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Full name must be between 2 and 100 characters' },
        { status: 422 }
      );
    }

    // Validate phone
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required and must be a string' },
        { status: 422 }
      );
    }

    const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX' },
        { status: 422 }
      );
    }

    const normalizedPhone = phone.toLowerCase();

    // Validate dob (optional, but if provided must be valid ISO date string)
    let parsedDob: Date | null = null;
    if (dob !== undefined && dob !== null) {
      try {
        parsedDob = new Date(dob);
        if (isNaN(parsedDob.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Date of birth must be a valid date' },
            { status: 422 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Date of birth must be a valid date' },
          { status: 422 }
        );
      }
    }

    // Validate village (optional)
    const trimmedVillage = village ? String(village).trim().substring(0, 100) : null;

    // Validate districtId
    if (!districtId) {
      return NextResponse.json(
        { success: false, error: 'District is required' },
        { status: 422 }
      );
    }

    const districtIdNumber = Number(districtId);
    if (!Number.isInteger(districtIdNumber) || districtIdNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'District ID must be a positive integer' },
        { status: 422 }
      );
    }

    // Validate facilityId
    if (!facilityId) {
      return NextResponse.json(
        { success: false, error: 'Facility is required' },
        { status: 422 }
      );
    }

    const facilityIdNumber = Number(facilityId);
    if (!Number.isInteger(facilityIdNumber) || facilityIdNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'Facility ID must be a positive integer' },
        { status: 422 }
      );
    }

    // Validate chwId
    // For CHW users: optional, defaults to their own ID
    // For other users: required
    let chwIdNumber: number;
    
    if (user.role === 'CHW') {
      // CHW creates a mother: default to self if not provided
      chwIdNumber = chwId ? Number(chwId) : user.id;
      if (chwId) {
        const parsedCHWId = Number(chwId);
        if (!Number.isInteger(parsedCHWId) || parsedCHWId <= 0) {
          return NextResponse.json(
            { success: false, error: 'CHW ID must be a positive integer' },
            { status: 422 }
          );
        }
        chwIdNumber = parsedCHWId;
      }
    } else {
      // Clinical staff and admins: chwId is required
      if (!chwId) {
        return NextResponse.json(
          { success: false, error: 'Assigned CHW is required' },
          { status: 422 }
        );
      }

      chwIdNumber = Number(chwId);
      if (!Number.isInteger(chwIdNumber) || chwIdNumber <= 0) {
        return NextResponse.json(
          { success: false, error: 'CHW ID must be a positive integer' },
          { status: 422 }
        );
      }
    }

    // Validate consentAccepted
    if (consentAccepted !== true) {
      return NextResponse.json(
        { success: false, error: 'Consent must be accepted' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 3. CHECK IF PHONE ALREADY REGISTERED
    // ========================================================================
    const existingMother = await db.mother.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingMother) {
      return NextResponse.json(
        { success: false, error: 'Phone number is already registered' },
        { status: 409 }
      );
    }

    // ========================================================================
    // 4. VERIFY DISTRICT, FACILITY, AND CHW EXIST
    // ========================================================================
    const [district, facility, chw] = await Promise.all([
      db.district.findUnique({
        where: { id: districtIdNumber },
        select: { id: true, name: true },
      }),
      db.facility.findUnique({
        where: { id: facilityIdNumber },
        select: { id: true, name: true, districtId: true },
      }),
      db.user.findUnique({
        where: { id: chwIdNumber },
        select: { id: true, name: true, role: true, isActive: true, districtId: true },
      }),
    ]);

    if (!district) {
      return NextResponse.json(
        { success: false, error: 'District not found' },
        { status: 404 }
      );
    }

    if (!facility) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    if (!chw) {
      return NextResponse.json(
        { success: false, error: 'CHW not found' },
        { status: 404 }
      );
    }

    // Verify CHW is active and has CHW role
    if (chw.role !== 'CHW') {
      return NextResponse.json(
        { success: false, error: 'Selected user is not a CHW' },
        { status: 422 }
      );
    }

    if (!chw.isActive) {
      return NextResponse.json(
        { success: false, error: 'Selected CHW is not active' },
        { status: 422 }
      );
    }

    // Verify facility belongs to the district
    if (facility.districtId !== districtIdNumber) {
      return NextResponse.json(
        { success: false, error: 'Facility does not belong to the selected district' },
        { status: 422 }
      );
    }

    // Verify CHW belongs to the district
    if (chw.districtId !== districtIdNumber) {
      return NextResponse.json(
        { success: false, error: 'CHW does not work in the selected district' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. CREATE MOTHER RECORD
    // ========================================================================
    const currentTime = new Date();
    const auditContext = extractAuditContext(request);

    const newMother = await db.mother.create({
      data: {
        fullName: trimmedFullName,
        phone: normalizedPhone,
        dob: parsedDob,
        village: trimmedVillage,
        districtId: districtIdNumber,
        facilityId: facilityIdNumber,
        chwId: chwIdNumber,
        consentAccepted: true,
        consentDate: currentTime,
        consentIp: auditContext.ipAddress,
        registeredById: user.id,
      },
      include: {
        district: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
        chw: { select: { id: true, name: true } },
      },
    });

    // ========================================================================
    // 6. WRITE AUDIT LOG
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'Mother',
      resourceId: newMother.id.toString(),
      changesSummary: {
        fullName: trimmedFullName,
        phone: normalizedPhone,
        districtId: districtIdNumber,
        facilityId: facilityIdNumber,
        chwId: chwIdNumber,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mother created successfully',
        data: newMother,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating mother:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
