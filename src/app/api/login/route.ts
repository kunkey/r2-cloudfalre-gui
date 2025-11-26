import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // khai báo kiểu cho dữ liệu nhận vào
  const body = (await req.json()) as { password: string };
  const { password } = body;

  if (password === process.env.APP_PASSWORD) {
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
