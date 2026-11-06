/**
 * public-url.ts (client-safe) — Hàm dựng link public cho object trên R2.
 *
 * Chỉ dùng biến NEXT_PUBLIC_* (được inline lúc build) nên chạy được cả
 * trong client component. Server-side dùng `@/server/public-url` (bản đầy đủ).
 */

/** Base URL public mặc định khi không cấu hình env. */
export const DEFAULT_PUBLIC_BASE_URL = 'https://cf-vng.com';

/** Lấy base URL public (không có dấu "/" cuối). */
export function getPublicBaseUrl(): string {
  const value = String(
    process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC || ''
  ).trim().replace(/\/+$/, '');

  return value || DEFAULT_PUBLIC_BASE_URL;
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
