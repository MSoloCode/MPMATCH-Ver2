/**
 * User Profile API Endpoints
 * GET: Retrieve user profile information
 * PATCH: Update user profile information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractUser, UnauthorizedError, ForbiddenError, ApiError } from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

// ============================================================================
// GET /api/users/profile - Retrieve user profile
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const user = extractUser(request);

    if (!user.userId) {
      return NextResponse.json(
        { success: false, error: 'User ID not found in token' },
        { status: 401 }
      );
    }

    // Fetch user profile
    const profile = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        district: { select: { id: true, name: true } },
        country: { select: { id: true, name: true } },
        hospital: { select: { id: true, name: true } },
        organisation: { select: { id: true, name: true } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // For COMMUNITY_USER, also fetch mother data
    let motherData = null;
    if (user.role === 'COMMUNITY_USER' && user.motherId) {
      motherData = await db.mother.findUnique({
        where: { id: user.motherId, deletedAt: null },
        select: {
          id: true,
          fullName: true,
          phone: true,
          dob: true,
          village: true,
          consentAccepted: true,
          consentDate: true,
          district: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
          chw: { select: { id: true, name: true, phone: true } },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: profile,
        mother: motherData,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/users/profile - Update user profile
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const user = extractUser(request);

    if (!user.userId) {
      return NextResponse.json(
        { success: false, error: 'User ID not found in token' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate fields
    const updateData: Record<string, any> = {};

    // Allowed fields for update
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Name must be between 2 and 100 characters' },
          { status: 422 }
        );
      }
      updateData.name = body.name.trim();
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

    if (body.email !== undefined) {
      if (body.email !== null && body.email !== '') {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof body.email !== 'string' || !emailRegex.test(body.email.trim())) {
          return NextResponse.json(
            { success: false, error: 'Invalid email format' },
            { status: 422 }
          );
        }

        // Check if email is already in use by another user
        const existingUser = await db.user.findUnique({
          where: { email: body.email.trim() },
        });

        if (existingUser && existingUser.id !== user.userId) {
          return NextResponse.json(
            { success: false, error: 'Email is already in use' },
            { status: 422 }
          );
        }

        updateData.email = body.email.trim();
      } else {
        updateData.email = null;
      }
    }

    // Immutable fields check
    const immutableFields = ['username', 'role', 'isActive', 'countryId', 'districtId', 'hospitalId', 'orgId', 'motherId'];
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

    // Update user
    const updatedUser = await db.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'User',
      resourceId: user.userId,
      changesSummary: updateData,
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    }).catch((err) => {
      console.error('Audit log error:', err);
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
