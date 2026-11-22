import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/server/auth';
import { completeMultipartUpload } from '@/server/r2';
import { buildPublicUrl } from '@/server/public-url';

export async function POST(request: NextRequest) {
  const unauthorized = checkApiAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      key: string;
      uploadId: string;
      parts: { PartNumber: number; ETag: string }[];
    };

    if (!body?.key || !body?.uploadId || !Array.isArray(body?.parts)) {
      return NextResponse.json(
        { error: 'Missing key, uploadId, or parts' },
        { status: 400 }
      );
    }

    const res = await completeMultipartUpload(body.key, body.uploadId, body.parts);
    const publicUrl = buildPublicUrl(body.key);

    return NextResponse.json({
      success: true,
      key: res.key,
      location: res.location,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error('Failed to complete multipart upload:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to complete multipart upload' },
      { status: 500 }
    );
  }
}
