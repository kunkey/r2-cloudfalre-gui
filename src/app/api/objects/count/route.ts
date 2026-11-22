import { listObjects } from '@/server/r2';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Đếm tổng số object (không tính thư mục) dưới một prefix.
 * Dùng để tính chính xác tổng số trang cho phân trang.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || undefined;

  let count = 0;
  let token: string | undefined;
  let truncated = false;

  try {
    do {
      // Delimiter = '/' để chỉ đếm file, không tính CommonPrefixes
      const result = await listObjects(prefix, token, 1000, true);
      const contents = (result as any).Contents || [];
      count += contents.length;
      truncated = Boolean((result as any).IsTruncated);
      token = (result as any).NextContinuationToken;
    } while (token);
  } catch (err) {
    console.error('count objects error:', err);
    return NextResponse.json({ error: 'Failed to count objects' }, { status: 500 });
  }

  return NextResponse.json({ count, truncated });
}
