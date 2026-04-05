import { NextRequest, NextResponse } from 'next/server';

/** Phản chiếu Origin hoặc * — cho phép mọi domain gọi /api/* từ trình duyệt. */
function resolveCorsAllowOrigin(request: NextRequest): string {
  return request.headers.get('origin')?.trim() || '*';
}

/** CORS cho /api/* (upload từ CMS khác origin, ví dụ localhost:3000 → localhost:3423). */
function middlewareApiCors(request: NextRequest): NextResponse {
  const corsOrigin = resolveCorsAllowOrigin(request);
  const reqHdrs = request.headers.get('access-control-request-headers');

  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', corsOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    headers.set(
      'Access-Control-Allow-Headers',
      reqHdrs || 'Authorization, Content-Type, X-Requested-With, Accept',
    );
    headers.set('Access-Control-Max-Age', '86400');
    if (corsOrigin !== '*') {
      headers.set('Vary', 'Origin');
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', corsOrigin);
  if (corsOrigin !== '*') {
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return middlewareApiCors(req);
  }

  const url = req.nextUrl.clone();
  const password = process.env.APP_PASSWORD;

  if (url.pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  const hasAuth = req.cookies.get('site_auth')?.value;

  if (!hasAuth || hasAuth !== password) {
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next|api|assets|favicon\\.ico|favicon\\.png|icon).*)',
  ],
};
