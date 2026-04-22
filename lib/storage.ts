import { promises as fs } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

/**
 * File Storage Abstraction Layer
 * Supports both S3-compatible storage and local filesystem storage
 * Falls back to local storage in development if S3 endpoint not configured
 */

export interface StorageConfig {
  bucket?: string;
  endpoint?: string;
  key?: string;
  secret?: string;
  nodeEnv?: string;
}

export interface UploadResult {
  fileUrl: string;
  storageUrl: string;
  storedName: string;
}

const DEFAULT_LOCAL_UPLOAD_DIR = '/tmp/uploads';

/**
 * Determine if S3 storage should be used
 */
function useS3Storage(config: StorageConfig): boolean {
  return !!(config.endpoint && config.bucket && config.key && config.secret);
}

/**
 * Generate AWS Signature v4 for S3 request
 */
function generateS3Signature(
  method: string,
  bucket: string,
  key: string,
  payload: Buffer,
  config: StorageConfig
): {
  headers: Record<string, string>;
} {
  const timestamp = new Date();
  const datestamp = timestamp.toISOString().split('T')[0].replace(/-/g, '');
  const amzDatetime = timestamp.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');

  // Canonical request
  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    method,
    `/${key}`,
    '',
    `content-type:application/octet-stream\nhost:${new URL(config.endpoint!).hostname}\nx-amz-content-sha256:${hashedPayload}\nx-amz-date:${amzDatetime}`,
    '',
    'content-type;host;x-amz-content-sha256;x-amz-date',
    hashedPayload,
  ].join('\n');

  // String to sign
  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const credentialScope = `${datestamp}/us-east-1/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDatetime, credentialScope, canonicalRequestHash].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${config.secret}`).update(datestamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update('us-east-1').digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.key}/${credentialScope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;

  return {
    headers: {
      'Authorization': authorizationHeader,
      'x-amz-content-sha256': hashedPayload,
      'x-amz-date': amzDatetime,
      'Content-Type': 'application/octet-stream',
    },
  };
}

/**
 * Upload file to S3-compatible storage
 */
async function uploadToS3(
  fileBuffer: Buffer,
  storedName: string,
  config: StorageConfig
): Promise<UploadResult> {
  const bucket = config.bucket!;
  const endpoint = config.endpoint!;
  const key = `${bucket}/${storedName}`;

  const signature = generateS3Signature('PUT', bucket, storedName, fileBuffer, config);

  const url = new URL(`${endpoint}/${storedName}`);
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: signature.headers,
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }

  const fileUrl = `/uploads/clinical-archives/${storedName}`;
  const storageUrl = `${endpoint}/${storedName}`;

  return { fileUrl, storageUrl, storedName };
}

/**
 * Upload file to local disk
 */
async function uploadToLocal(
  fileBuffer: Buffer,
  storedName: string,
  uploadDir: string = DEFAULT_LOCAL_UPLOAD_DIR
): Promise<UploadResult> {
  try {
    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, storedName);
    await fs.writeFile(filePath, fileBuffer);

    const fileUrl = `/uploads/clinical-archives/${storedName}`;
    const storageUrl = `${uploadDir}/${storedName}`;

    return { fileUrl, storageUrl, storedName };
  } catch (error) {
    throw new Error(`Local file upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main upload function - routes to S3 or local storage based on config
 */
export async function uploadFile(
  fileBuffer: Buffer,
  mimeType: string,
  config: StorageConfig = {}
): Promise<UploadResult> {
  // Validate input
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // Generate unique filename with extension
  const ext = getExtensionFromMimeType(mimeType);
  const storedName = `${crypto.randomUUID()}${ext}`;

  // Use S3 if configured, otherwise use local storage
  if (useS3Storage(config)) {
    return uploadToS3(fileBuffer, storedName, config);
  } else {
    return uploadToLocal(fileBuffer, storedName);
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };

  return mimeToExt[mimeType] || '.bin';
}

/**
 * Validate file MIME type
 */
export function isValidMimeType(mimeType: string): boolean {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  return allowedMimeTypes.includes(mimeType);
}

/**
 * Validate file size (in bytes)
 */
export function isValidFileSize(sizeBytes: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

/**
 * Get storage configuration from environment variables
 */
export function getStorageConfig(): StorageConfig {
  return {
    bucket: process.env.STORAGE_BUCKET,
    endpoint: process.env.STORAGE_ENDPOINT,
    key: process.env.STORAGE_KEY,
    secret: process.env.STORAGE_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
}
