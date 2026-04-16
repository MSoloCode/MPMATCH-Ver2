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
