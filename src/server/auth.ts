import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth dùng chung cho các API endpoint.
 *
 * Passkey lấy từ APP_PASSWORD (fallback NEXT_PUBLIC_APP_PASSWORD).
 * Client có thể gửi passkey theo 3 cách:
 *   1. Authorization: Bearer <APP_PASSWORD>
 *   2. x-api-key: <APP_PASSWORD>
 *   3. Cookie: site_auth=<APP_PASSWORD>   (tiện cho request same-origin từ trình duyệt)
 */

/** So sánh chuỗi an toàn về timing (tránh lộ thông tin qua response time). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Vẫn chạy 1 lần compare để giữ thời gian xử lý không lộ độ dài khác biệt rõ ràng.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Lấy passkey đã cấu hình, hoặc null nếu chưa cấu hình. */
export function getApiPassword(): string | null {
  return process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || null;
}

/** Lấy passkey từ request (header hoặc cookie). */
export function extractProvidedKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (bearer) return bearer;
  }

  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader?.trim()) return apiKeyHeader.trim();

  const cookieKey = request.cookies.get('site_auth')?.value;
  if (cookieKey) return cookieKey;

  return null;
}

/**
 * Kiểm tra passkey của request.
 *
 * Trả về `null` nếu hợp lệ, hoặc một NextResponse lỗi 401 nếu không.
 * Nếu chưa cấu hình APP_PASSWORD thì cho qua (môi trường dev) và log cảnh báo.
 */
export function checkApiAuth(request: NextRequest): NextResponse | null {
  const expected = getApiPassword();

  if (!expected) {
    console.warn(
      '[auth] APP_PASSWORD chưa được cấu hình — bỏ qua kiểm tra passkey. ' +
        'Hãy set APP_PASSWORD trong .env trước khi deploy production.',
    );
    return null;
  }

  const provided = extractProvidedKey(request);

  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing or invalid API key' },
      { status: 401 },
    );
  }

  return null;
}
