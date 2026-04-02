import { NextRequest, NextResponse } from 'next/server';

/** Origins được phép gọi API (CMS, v.v.). Mặc định gồm Next.js dev thường gặp. */
function getAllowedOrigins(): Set<string> {
  const fallback = 'http://localhost:3000,http://127.0.0.1:3000';
  const raw = process.env.CORS_ALLOWED_ORIGINS || fallback;
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

const allowedOrigins = getAllowedOrigins();

function resolveCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  if (allowedOrigins.has(origin)) return origin;
  return null;
}

/** CORS cho /api/* (upload từ CMS khác origin, ví dụ localhost:3000 → localhost:3423). */
function middlewareApiCors(request: NextRequest): NextResponse {
  const corsOrigin = resolveCorsOrigin(request);
  const reqHdrs = request.headers.get('access-control-request-headers');

  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    if (corsOrigin) {
      headers.set('Access-Control-Allow-Origin', corsOrigin);
    }
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    headers.set(
      'Access-Control-Allow-Headers',
      reqHdrs || 'Authorization, Content-Type, X-Requested-With, Accept',
    );
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  if (corsOrigin) {
    res.headers.set('Access-Control-Allow-Origin', corsOrigin);
  }
  res.headers.set('Vary', 'Origin');
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
