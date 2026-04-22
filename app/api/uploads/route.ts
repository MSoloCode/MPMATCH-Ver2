import { NextRequest, NextResponse } from 'next/server';
import {
  extractUser,
  UnauthorizedError,
  assertValidTenantScope,
  ForbiddenError,
  getTenantScopingFilter,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import {
  uploadFile,
  isValidMimeType,
  isValidFileSize,
  getStorageConfig,
  getExtensionFromMimeType,
} from '@/lib/storage';
import { db } from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/uploads
 * Upload a file with metadata and create ClinicalArchive record
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN, COMMUNITY_USER
 * COMMUNITY_USER can only upload to their own pregnancies
 *
 * Request (FormData):
 * - file: File (image/jpeg, image/png, image/webp, application/pdf, max 10MB)
 * - pregnancyId: number (required)
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "data": {
 *     "fileUrl": "/uploads/clinical-archives/{uuid}.pdf",
 *     "fileId": 123
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Invalid file type..."
 * }
 *
 * Response on file too large (413):
 * {
 *   "success": false,
 *   "error": "File size exceeds maximum allowed size of 10MB"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
      throw error;
    }

    // Verify user has permission to upload files
    const allowedRoles = [
      'DOCTOR',
      'NURSE',
      'MIDWIFE',
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
      'COMMUNITY_USER',
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to upload files',
        },
        { status: 403 }
      );
    }

    // Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 2. PARSE FORM DATA
    // ========================================================================
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid FormData',
        },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    const pregnancyIdStr = formData.get('pregnancyId') as string | null;

    // ========================================================================
    // 3. VALIDATE FILE AND REQUEST
    // ========================================================================
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'file is required',
        },
        { status: 400 }
      );
    }

    if (!pregnancyIdStr) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId is required',
        },
        { status: 422 }
      );
    }

    const pregnancyId = parseInt(pregnancyIdStr, 10);
    if (isNaN(pregnancyId) || pregnancyId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId must be a positive integer',
        },
        { status: 422 }
      );
    }

    // Validate MIME type (strict requirement)
    if (!isValidMimeType(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Allowed: image/jpeg, image/png, image/webp, application/pdf',
        },
        { status: 422 }
      );
    }

    // Validate file size (return 413 if exceeded)
    if (!isValidFileSize(file.size, 10)) {
      return NextResponse.json(
        {
          success: false,
          error: 'File size exceeds maximum allowed size of 10MB',
        },
        { status: 413 }
      );
    }

    // ========================================================================
    // 4. VERIFY PREGNANCY EXISTS AND USER HAS ACCESS
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as any);
    const pregnancy = await db.pregnancy.findFirst({
      where: {
        id: pregnancyId,
        ...scopeFilter,
      },
      include: {
        mother: true,
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found or access denied',
        },
        { status: 404 }
      );
    }

    // For COMMUNITY_USER, verify they own this pregnancy
    if (user.role === 'COMMUNITY_USER') {
      if (pregnancy.mother.id !== user.motherId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access denied: Can only upload to own pregnancy records',
          },
          { status: 403 }
        );
      }
    }

    // ========================================================================
    // 5. UPLOAD FILE TO STORAGE (S3 or local)
    // ========================================================================
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageConfig = getStorageConfig();

    let uploadResult;
    try {
      uploadResult = await uploadFile(buffer, file.type, storageConfig);
    } catch (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload file to storage',
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // 6. CREATE CLINICAL ARCHIVE RECORD WITH FILE METADATA
    // ========================================================================
    let clinicalArchive;
    try {
      clinicalArchive = await db.clinicalArchive.create({
        data: {
          pregnancyId,
          motherId: pregnancy.motherId,
          type: 'OTHER', // Default type for generic uploads
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for title
          fileUrl: uploadResult.fileUrl,
          originalName: file.name,
          storedName: uploadResult.storedName,
          mimeType: file.type,
          sizeBytes: BigInt(file.size),
          storageUrl: uploadResult.storageUrl,
          uploadedById: user.userId,
          uploadedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Database error creating ClinicalArchive:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create file record',
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'file_upload',
      resourceId: clinicalArchive.id,
      changesSummary: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        pregnancyId,
        storedName: uploadResult.storedName,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    // ========================================================================
    // 8. RETURN SUCCESS
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          fileUrl: uploadResult.fileUrl,
          fileId: clinicalArchive.id,
        },
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred during file upload',
      },
      { status: 500 }
    );
  }
}
