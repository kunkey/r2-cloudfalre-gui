import { NextRequest, NextResponse } from 'next/server';
import { getFolderStats } from '@/server/r2';

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix') || '';
  try {
    const { count, totalSize } = await getFolderStats(prefix);
    return NextResponse.json({ count, totalSize });
  } catch (error: any) {
    console.error('Folder stats failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to get stats' }, { status: 500 });
  }
}
