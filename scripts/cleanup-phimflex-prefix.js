/**
 * Dọn toàn bộ object test trong prefix Phimflex/ (chỉ dùng khi test trên bucket thật).
 * CẢNH BÁO: xoá cả dữ liệu thật nếu đã dùng chung prefix.
 *
 * Usage: node scripts/cleanup-phimflex-prefix.js --confirm
 */
const BASE = process.env.R2_BASE || 'http://localhost:3423';
const TOKEN = process.env.APP_PASSWORD || '123123123@@';
const PREFIX = process.env.CLEANUP_PREFIX || 'Phimflex/';

async function listAll(prefix) {
  const out = [];
  let token;
  do {
    const url = new URL(`${BASE}/api/objects`);
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('limit', '1000');
    if (token) url.searchParams.set('continuationToken', token);
    const data = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
    for (const o of data.Contents || []) if (o.Key) out.push(o.Key);
    token = data.NextContinuationToken;
  } while (token);
  return out;
}

(async () => {
  if (!process.argv.includes('--confirm')) {
    console.log('Thêm --confirm để chạy (xoá vĩnh viễn).');
    return;
  }
  const keys = await listAll(PREFIX);
  console.log(`Tìm thấy ${keys.length} object dưới "${PREFIX}"`);
  if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 500) {
    const batch = keys.slice(i, i + 500);
    const res = await fetch(`${BASE}/api/objects`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ keys: batch }),
    });
    console.log(`  xoá ${batch.length} -> HTTP ${res.status}`);
  }
})();
