import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth dùng chung cho các API endpoint.
 *
 * Passkey lấy từ APP_PASSWORD (fallback NEXT_PUBLIC_APP_PASSWORD).
 * Client có thể gửi passkey theo 3 cách:
 *   1. Authorization: Bearer <APP_PASSWORD>
 *   2. x-api-key: <APP_PASSWORD>
 *   3. Cookie: site_auth=<APP_PASSWORD>   (tiện cho request same-origin từ trình duyệt)
 *
 * Ngoài passkey chính, server chấp nhận thêm các alias (APP_PASSWORD_ALIASES,
 * phân tách bằng dấu phẩy) để các service cũ đang dùng passkey khác vẫn hoạt động.
 */

/**
 * So sánh chuỗi an toàn về timing (tránh lộ thông tin qua response time).
 *
 * Cài đặt thuần JS (không dùng `crypto` của Node) để file này import được
 * ở cả Edge runtime (middleware) lẫn Node runtime (route handlers).
 */
function safeEqual(a: string, b: string): boolean {
  const strA = String(a);
  const strB = String(b);
  const lenA = strA.length;
  const lenB = strB.length;

  // Luôn duyệt đủ max(lenA, lenB) để thời gian xử lý không phụ thuộc độ dài.
  const maxLen = Math.max(lenA, lenB);
  let diff = lenA ^ lenB;

  for (let i = 0; i < maxLen; i++) {
    const codeA = i < lenA ? strA.charCodeAt(i) : 0;
    const codeB = i < lenB ? strB.charCodeAt(i) : 0;
    diff |= codeA ^ codeB;
  }

  return diff === 0;
}

/** Lấy passkey đã cấu hình, hoặc null nếu chưa cấu hình. */
export function getApiPassword(): string | null {
  return process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || null;
}

/**
 * Danh sách passkey hợp lệ: passkey chính + các alias.
 * Alias lấy từ APP_PASSWORD_ALIASES (dấu phẩy phân tách).
 */
export function getApiPasswords(): string[] {
  const list: string[] = [];

  const primary = getApiPassword();
  if (primary) list.push(primary);

  const aliases = String(process.env.APP_PASSWORD_ALIASES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const alias of aliases) {
    if (!list.includes(alias)) list.push(alias);
  }

  return list;
}

/** Kiểm tra passkey có nằm trong danh sách hợp lệ không. */
export function isValidApiKey(provided: string | null | undefined): boolean {
  if (!provided) return false;
  return getApiPasswords().some((expected) => safeEqual(provided, expected));
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

  if (!isValidApiKey(provided)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing or invalid API key' },
      { status: 401 },
    );
  }

  return null;
}
