/**
 * Profile Picture Upload API
 * POST: Upload and save user profile picture
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractUser, ApiError } from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// POST /api/users/profile/upload-avatar - Upload profile picture
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const user = extractUser(request);

    if (!user.userId) {
      return NextResponse.json(
        { success: false, error: 'User ID not found in token' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 422 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 422 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create avatars directory if it doesn't exist
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Generate unique filename using timestamp and userId
    const fileExtension = file.name.split('.').pop();
    const filename = `avatar_${user.userId}_${Date.now()}.${fileExtension}`;
    const filepath = path.join(avatarsDir, filename);

    // Write file to disk
    fs.writeFileSync(filepath, buffer);

    // Store relative URL path
    const profilePictureUrl = `/avatars/${filename}`;

    // Update user profile with picture URL
    const updatedUser = await db.user.update({
      where: { id: user.userId },
      data: {
        profilePictureUrl,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        profilePictureUrl: true,
      },
    });

    // Audit log
    writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'User',
      resourceId: user.userId,
      changesSummary: { profilePictureUrl },
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    }).catch((err) => {
      console.error('Audit log error:', err);
    });

    return NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        profilePictureUrl,
      },
      message: 'Profile picture uploaded successfully',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}
