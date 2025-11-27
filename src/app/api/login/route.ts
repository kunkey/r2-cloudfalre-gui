import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // khai báo kiểu cho dữ liệu nhận vào
  const body = (await req.json()) as { password: string };
  const { password } = body;

  if (password === process.env.APP_PASSWORD) {
    const res = NextResponse.json({ ok: true });

    // Đặt cookie đăng nhập
    res.cookies.set("site_auth", process.env.APP_PASSWORD, {
      httpOnly: false, // ❗ cho phép JS delete
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
      secure: true,     // bắt buộc HTTPS
      sameSite: "strict"
    });

    return res;
  } else {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
