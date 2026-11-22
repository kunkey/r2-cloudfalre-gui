import { NextRequest, NextResponse } from 'next/server';
import { getApiPasswords, isValidApiKey } from '@/server/auth';

export async function POST(req: NextRequest) {
  // khai báo kiểu cho dữ liệu nhận vào
  const body = (await req.json()) as { password: string };
  const { password } = body;

  if (isValidApiKey(password)) {
    const res = NextResponse.json({ ok: true });

    // Đặt cookie đăng nhập (dùng passkey chính làm giá trị cookie)
    res.cookies.set('site_auth', getApiPasswords()[0], {
      httpOnly: false, // ❗ cho phép JS delete
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
      secure: true, // bắt buộc HTTPS
      sameSite: 'strict',
    });

    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
