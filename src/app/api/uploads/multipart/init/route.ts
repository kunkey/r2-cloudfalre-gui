import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/server/auth';
import { createMultipartUpload } from '@/server/r2';

export async function POST(request: NextRequest) {
  const unauthorized = checkApiAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { key: string; contentType?: string };
    if (!body?.key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const res = await createMultipartUpload(body.key, body.contentType);
    return NextResponse.json(res);
  } catch (err: any) {
    console.error('Failed to init multipart upload:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to initialize multipart upload' },
      { status: 500 }
    );
  }
}
