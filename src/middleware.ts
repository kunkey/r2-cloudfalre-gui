import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const password = process.env.APP_PASSWORD;

  // Không check ở trang /auth
  if (url.pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Lấy cookie chứng thực
  const hasAuth = req.cookies.get('site_auth')?.value;

  if (!hasAuth || hasAuth !== password) {
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|assets|favicon.ico|api).*)'],
};
