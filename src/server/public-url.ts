/**
 * public-url.ts — Xác định base URL public của bucket R2.
 *
 * Thứ tự ưu tiên:
 *   1. CLOUDFLARE_BUCKET_URL            (server-only, ưu tiên cao nhất)
 *   2. PUBLIC_BASE_URL                 (server-only, alias rõ ràng)
 *   3. NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC (inlined lúc build, dùng cho client)
 *   4. DEFAULT_PUBLIC_BASE_URL         (fallback cứng = https://cf-vng.com)
 *
 * Nhờ có fallback cứng, server luôn trả về link public dùng được
 * (không bao giờ rơi về endpoint nội bộ `*.r2.cloudflarestorage.com`).
 */

/** Base URL public mặc định khi không cấu hình env. */
export const DEFAULT_PUBLIC_BASE_URL = 'https://cf-vng.com';

/**
 * Endpoint S3 nội bộ của R2 — KHÔNG phải URL public, không dùng để trả link cho client.
 * (https://<account_id>.r2.cloudflarestorage.com/storages/...)
 */
function isInternalR2Endpoint(value: string): boolean {
  return /\.r2\.cloudflarestorage\.com/i.test(value) || /\/storages(\/|$)/i.test(value);
}

/**
 * Lấy base URL public (không có dấu "/" cuối).
 *
 * Bỏ qua các giá trị trỏ tới endpoint nội bộ R2, vì link đó không public
 * và client bên ngoài không tải được.
 */
export function getPublicBaseUrl(): string {
  const candidates = [
    process.env.CLOUDFLARE_BUCKET_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim().replace(/\/+$/, '');
    if (!value) continue;
    if (isInternalR2Endpoint(value)) {
      console.warn(
        `[public-url] Bỏ qua base URL không public: "${value}". Hãy dùng CDN public (vd: ${DEFAULT_PUBLIC_BASE_URL}).`
      );
      continue;
    }
    return value;
  }

  return DEFAULT_PUBLIC_BASE_URL.replace(/\/+$/, '');
}

/** Encode key thành path URL (giữ dấu "/" làm separator). */
export function encodeObjectKey(key: string): string {
  return String(key || '')
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Dựng URL public cho một object key. */
export function buildPublicUrl(key: string, baseUrl?: string): string {
  const base = String(baseUrl ?? getPublicBaseUrl()).replace(/\/+$/, '');
  const encoded = encodeObjectKey(key);
  return encoded ? `${base}/${encoded}` : base;
}
