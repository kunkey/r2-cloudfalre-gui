/**
 * Test script mô phỏng đúng luồng CMS:
 *  1. ensureRemoteFolders('Phimflex/Images/Banners/movie-abc')
 *  2. uploadBatchXhr nhiều file (m3u8 + ts + key + mp4) trong 1 request
 *  3. verify key + url trả về
 */
const BASE = process.env.R2_BASE || 'http://localhost:3423';
const TOKEN = process.env.APP_PASSWORD || '123123123@@';

async function ensureRemoteFolders(folderPath) {
  const clean = String(folderPath || '').replace(/\\/g, '/').split('/').map((s) => s.trim()).filter(Boolean);
  const created = [];
  let parent = '';
  for (const segment of clean) {
    parent = parent ? `${parent}/${segment}` : segment;
    const res = await fetch(`${BASE}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        parentPrefix: parent.split('/').slice(0, -1).join('/'),
        name: segment,
      }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`  folder "${parent}/" -> HTTP ${res.status}`, res.ok ? '' : JSON.stringify(data));
    if (res.ok) created.push(`${parent}/`);
  }
  return created;
}

async function uploadBatch(items) {
  const form = new FormData();
  for (const { name, key, body, type } of items) {
    form.append('file', new Blob([body], { type }), name);
    form.append('key', key);
  }
  const res = await fetch(`${BASE}/api/uploads/direct`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  console.log(`  upload -> HTTP ${res.status}`);
  return data;
}

(async () => {
  console.log('1) Tạo cây thư mục (mô phỏng ensureRemoteFolders):');
  await ensureRemoteFolders('Phimflex/Images/Banners/movie-abc');
  await ensureRemoteFolders('Phimflex/Videos/Trailers/movie-abc');

  console.log('\n2) Upload batch HLS + MP4 (mô phỏng uploadBatchXhr):');
  const data = await uploadBatch([
    { name: 'master.m3u8', key: 'Phimflex/Videos/Trailers/movie-abc/master.m3u8', body: '#EXTM3U\n#EXT-X-VERSION:3\nseg-0.ts\n', type: 'application/vnd.apple.mpegurl' },
    { name: 'seg-0.ts', key: 'Phimflex/Videos/Trailers/movie-abc/seg-0.ts', body: Buffer.alloc(376, 0x47), type: 'video/mp2t' },
    { name: 'enc.key', key: 'Phimflex/Videos/Trailers/movie-abc/enc.key', body: '0123456789abcdef0123456789abcdef', type: 'application/octet-stream' },
    { name: 'video.mp4', key: 'Phimflex/Videos/Collections/movie-abc/video.mp4', body: Buffer.concat([Buffer.from([0,0,0,0x66]), Buffer.from('ftypisom')]), type: 'video/mp4' },
    { name: 'poster.jpg', key: 'Phimflex/Images/Banners/movie-abc/poster.jpg', body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), type: 'image/jpeg' },
  ]);
  console.log(JSON.stringify(data, null, 2));

  console.log('\n3) Kiểm tra folder đã tạo trên R2:');
  const list = await fetch(`${BASE}/api/objects?prefix=Phimflex/&delimiter=/`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then((r) => r.json());
  console.log('  CommonPrefixes:', (list.CommonPrefixes || []).map((p) => p.Prefix).join(', '));
})();
