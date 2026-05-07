import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/mothers/me
 * Retrieve authenticated mother's profile
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "motherId": 1,
 *     "fullName": "Jane Doe",
 *     "phone": "+256701234567",
 *     "district": "Kampala",
 *     "village": "Bukoto",
 *     "consentAccepted": true,
 *     "consentDate": "2026-04-15T10:30:00Z"
 *   }
 * }
 *
 * Response on missing token (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on invalid token (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - invalid token"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION HEADER
    // ========================================================================
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - no token provided',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // ========================================================================
    // 2. VERIFY JWT TOKEN
    // ========================================================================
    let decodedToken: any;

    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - invalid token',
          },
          { status: 401 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 3. VERIFY MOTHER EXISTS IN DATABASE
    // ========================================================================
    const motherId = decodedToken.motherId;

    if (!motherId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - token missing motherId',
        },
        { status: 401 }
      );
    }

    const mother = await db.mother.findUnique({
      where: { id: motherId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        village: true,
        districtId: true,
        facilityId: true,
        chwId: true,
        consentAccepted: true,
        consentDate: true,
        district: {
          select: {
            id: true,
            name: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    if (!mother) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mother not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. RETURN AUTHENTICATED USER DATA
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          id: mother.id,
          fullName: mother.fullName,
          phone: mother.phone,
          village: mother.village,
          districtId: mother.districtId,
          district: {
            id: mother.district.id,
            name: mother.district.name,
          },
          facilityId: mother.facilityId,
          facility: mother.facility,
          chwId: mother.chwId,
          consentAccepted: mother.consentAccepted,
          consentDate: mother.consentDate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/mothers/me:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/mothers/me - Update authenticated mother's profile
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION HEADER
    // ========================================================================
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - no token provided',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // ========================================================================
    // 2. VERIFY JWT TOKEN
    // ========================================================================
    let decodedToken: any;

    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - invalid token',
          },
          { status: 401 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 3. EXTRACT MOTHER ID FROM TOKEN
    // ========================================================================
    const motherId = decodedToken.motherId;

    if (!motherId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - token missing motherId',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 4. PARSE REQUEST BODY
    // ========================================================================
    const body = await request.json();

    // Validate and prepare update data
    const updateData: Record<string, any> = {};

    if (body.fullName !== undefined) {
      if (typeof body.fullName !== 'string' || body.fullName.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: 'Full name must be at least 2 characters' },
          { status: 422 }
        );
      }
      updateData.fullName = body.fullName.trim();
    }

    if (body.phone !== undefined) {
      if (body.phone !== null && (typeof body.phone !== 'string' || body.phone.trim().length < 7)) {
        return NextResponse.json(
          { success: false, error: 'Phone must be at least 7 characters' },
          { status: 422 }
        );
      }
      updateData.phone = body.phone ? body.phone.trim() : null;
    }

    if (body.village !== undefined) {
      if (body.village !== null && typeof body.village !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Village must be a string or null' },
          { status: 422 }
        );
      }
      updateData.village = body.village ? body.village.trim() : null;
    }

    if (body.dob !== undefined) {
      if (body.dob !== null && typeof body.dob !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Date of birth must be a valid date string or null' },
          { status: 422 }
        );
      }
      updateData.dob = body.dob ? new Date(body.dob) : null;
    }

    // Immutable fields check
    const immutableFields = ['id', 'districtId', 'facilityId', 'chwId', 'consentAccepted', 'consentDate'];
    for (const field of immutableFields) {
      if (body[field] !== undefined) {
        return NextResponse.json(
          { success: false, error: `Cannot modify immutable field: ${field}` },
          { status: 422 }
        );
      }
    }

    // If no valid fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. UPDATE MOTHER RECORD
    // ========================================================================
    const updatedMother = await db.mother.update({
      where: { id: motherId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        phone: true,
        village: true,
        dob: true,
        districtId: true,
        facilityId: true,
        chwId: true,
        consentAccepted: true,
        consentDate: true,
        district: {
          select: {
            id: true,
            name: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ========================================================================
    // 6. RETURN UPDATED DATA
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          id: updatedMother.id,
          fullName: updatedMother.fullName,
          phone: updatedMother.phone,
          village: updatedMother.village,
          dob: updatedMother.dob,
          districtId: updatedMother.districtId,
          district: {
            id: updatedMother.district.id,
            name: updatedMother.district.name,
          },
          facilityId: updatedMother.facilityId,
          facility: updatedMother.facility,
          chwId: updatedMother.chwId,
          consentAccepted: updatedMother.consentAccepted,
          consentDate: updatedMother.consentDate,
        },
        message: 'Profile updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }
    console.error('Unexpected error in PATCH /api/mothers/me:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
