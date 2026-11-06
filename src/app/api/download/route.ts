import { presignGet } from '@/server/r2';
import { buildPublicUrl, getPublicBaseUrl } from '@/server/public-url';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { keys } = (await request.json()) as { keys: string[] };

  const publicBase = getPublicBaseUrl();
  if (publicBase) {
    const links = (keys as string[]).map((key) => buildPublicUrl(key, publicBase));
    return NextResponse.json({ mode: 'public', links });
  }

  const links = await Promise.all(
    keys.map((key: string) => {
      return presignGet(key);
    })
  );

  return NextResponse.json({ mode: 'signed', links });
}
