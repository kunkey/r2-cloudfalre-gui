import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/server/auth';
import { uploadPart } from '@/server/r2';

export async function POST(request: NextRequest) {
  const unauthorized = checkApiAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const key = form.get('key') as string;
    const uploadId = form.get('uploadId') as string;
    const partNumberStr = form.get('partNumber') as string;
    const chunk = form.get('chunk') as File | null;

    if (!key || !uploadId || !partNumberStr || !chunk) {
      return NextResponse.json(
        { error: 'Missing key, uploadId, partNumber, or chunk' },
        { status: 400 }
      );
    }

    const partNumber = parseInt(partNumberStr, 10);
    if (isNaN(partNumber) || partNumber < 1) {
      return NextResponse.json({ error: 'Invalid partNumber' }, { status: 400 });
    }

    const buf = Buffer.from(await chunk.arrayBuffer());
    const res = await uploadPart(key, uploadId, partNumber, buf);

    return NextResponse.json({
      partNumber: res.partNumber,
      etag: res.etag,
    });
  } catch (err: any) {
    console.error('Failed to upload part:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to upload part' },
      { status: 500 }
    );
  }
}
