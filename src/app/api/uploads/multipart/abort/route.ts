import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/server/auth';
import { abortMultipartUpload } from '@/server/r2';

export async function POST(request: NextRequest) {
  const unauthorized = checkApiAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { key: string; uploadId: string };
    if (!body?.key || !body?.uploadId) {
      return NextResponse.json({ error: 'Missing key or uploadId' }, { status: 400 });
    }

    await abortMultipartUpload(body.key, body.uploadId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to abort multipart upload:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to abort multipart upload' },
      { status: 500 }
    );
  }
}
