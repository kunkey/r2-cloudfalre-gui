/**
 * Test upload script for R2 Gallery public upload API (/api/uploads/direct)
 *
 * Cách dùng:
 *   1. Test tự động (test cả upload file & upload qua URL với .gif, .png, .json):
 *      node scripts/test-upload.js
 *
 *   2. Test upload 1 file local cụ thể:
 *      node scripts/test-upload.js path/to/my-animation.gif [folder]
 *
 *   3. Test upload file từ 1 URL cụ thể:
 *      node scripts/test-upload.js "https://example.com/demo.gif" [folder]
 *
 * Ví dụ:
 *   node scripts/test-upload.js ./banner.gif Images/Ads
 *   node scripts/test-upload.js "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif" Images/Gifs
 */

const fs = require('fs');
const path = require('path');

// Đọc cấu hình từ .env nếu có
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3423';
const UPLOAD_URL = `${API_BASE.replace(/\/+$/, '')}/api/uploads/direct`;
const AUTH_PASSWORD = process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || '123123123@@';

// 1x1 valid transparent GIF (GIF89a)
const SAMPLE_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// 1x1 valid PNG
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function uploadFile(buffer, filename, folder = 'Test_Uploads', key = null) {
  const formData = new FormData();
  const blob = new Blob([buffer]);
  formData.append('file', blob, filename);

  if (key) {
    formData.append('key', key);
  } else if (folder) {
    formData.append('folder', folder);
  }

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_PASSWORD}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function uploadViaUrl(fileUrl, folder = 'Test_Uploads', key = null) {
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_PASSWORD}`,
    },
    body: JSON.stringify({
      url: fileUrl,
      folder: folder || '',
      key: key || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload via URL failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function verifyPublicUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return {
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function deleteR2Object(key) {
  try {
    await fetch(`${API_BASE.replace(/\/+$/, '')}/api/objects`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_PASSWORD}`,
      },
      body: JSON.stringify({ keys: [key] }),
    });
  } catch {}
}

async function runTargetTest(target, folderArg) {
  const isUrl = target.startsWith('http://') || target.startsWith('https://');

  console.log(`\n========================================`);
  console.log(`📤 Testing ${isUrl ? 'URL' : 'Local File'} upload: ${target}`);
  console.log(`Target API: ${UPLOAD_URL}`);
  console.log(`========================================\n`);

  const folder = folderArg || 'Test_Uploads';
  const start = Date.now();
  let result;

  if (isUrl) {
    result = await uploadViaUrl(target, folder);
  } else {
    if (!fs.existsSync(target)) {
      console.error(`❌ File không tồn tại: ${target}`);
      process.exit(1);
    }
    const filename = path.basename(target);
    const buffer = fs.readFileSync(target);
    console.log(`- File name: ${filename} (${buffer.length} bytes)`);
    result = await uploadFile(buffer, filename, folder);
  }

  const elapsed = Date.now() - start;
  console.log(`\n✅ Upload thành công (${elapsed}ms)!`);
  console.log('API Response:', JSON.stringify(result, null, 2));

  const uploadedKey = result.uploaded?.[0];
  const uploadedUrl = result.urls?.[0];

  console.log(`\n🔍 Key được lưu trên R2: ${uploadedKey}`);
  console.log(`🌐 Public URL: ${uploadedUrl}`);

  const targetExt = isUrl ? path.extname(new URL(target).pathname).toLowerCase() : path.extname(target).toLowerCase();
  const uploadedExt = path.extname(uploadedKey).toLowerCase();

  if (!targetExt || targetExt === uploadedExt) {
    console.log(`🎉 Đuôi file kết quả: [${uploadedExt}]`);
  } else {
    console.warn(`⚠️ Đuôi file gốc là [${targetExt}], kết quả là [${uploadedExt}]`);
  }

  if (uploadedUrl) {
    console.log(`\nKiểm tra truy cập Public URL...`);
    const check = await verifyPublicUrl(uploadedUrl);
    console.log(`- HTTP Status: ${check.status}`);
    console.log(`- Content-Type: ${check.contentType}`);
  }
}

async function runAutoTests() {
  console.log(`\n======================================================`);
  console.log(`🚀 BẮT ĐẦU TEST PUBLIC UPLOAD API (R2 GALLERY)`);
  console.log(`Target: ${UPLOAD_URL}`);
  console.log(`======================================================\n`);

  const uploadedKeys = [];

  // 1. Tests upload tệp trực tiếp
  console.log(`--- [PHẦN 1: TEST UPLOAD LOCAL FILE / MULTIPART] ---`);
  const fileTestCases = [
    {
      name: `test-animation-${Date.now()}.gif`,
      buffer: Buffer.from(SAMPLE_GIF_BASE64, 'base64'),
      expectedExt: '.gif',
      expectedMime: 'image/gif',
      folder: 'Test_Uploads/Gifs',
    },
    {
      name: `test-image-${Date.now()}.png`,
      buffer: Buffer.from(SAMPLE_PNG_BASE64, 'base64'),
      expectedExt: '.png',
      expectedMime: 'image/png',
      folder: 'Test_Uploads/Images',
    },
    {
      name: `test-doc-${Date.now()}.json`,
      buffer: Buffer.from(JSON.stringify({ hello: 'world', time: new Date().toISOString() })),
      expectedExt: '.json',
      expectedMime: 'application/json',
      folder: 'Test_Uploads/Docs',
    },
    {
      name: `test-no-folder-${Date.now()}.gif`,
      buffer: Buffer.from(SAMPLE_GIF_BASE64, 'base64'),
      expectedExt: '.gif',
      expectedMime: 'image/gif',
      folder: '', // Test upload thẳng vào ROOT
    },
  ];

  for (let i = 0; i < fileTestCases.length; i++) {
    const tc = fileTestCases[i];
    console.log(`\n[Test File #${i + 1}] Uploading ${tc.name} ${tc.folder ? `vào folder: ${tc.folder}` : `vào ROOT`}`);

    try {
      const res = await uploadFile(tc.buffer, tc.name, tc.folder);
      const key = res.uploaded?.[0];
      const url = res.urls?.[0];
      uploadedKeys.push(key);

      console.log(`  ✓ Upload response:`, { key, url });

      const resultExt = path.extname(key).toLowerCase();
      if (resultExt === tc.expectedExt) {
        console.log(`  ✅ Đuôi file giữ nguyên: ${resultExt}`);
      } else {
        console.error(`  ❌ LỖI: Đuôi file bị đổi từ ${tc.expectedExt} thành ${resultExt}`);
      }

      if (url) {
        const head = await verifyPublicUrl(url);
        console.log(`  ✓ Public URL check: Status=${head.status}, Content-Type=${head.contentType}`);
        if (head.status === 200 && head.contentType === tc.expectedMime) {
          console.log(`  ✅ Content-Type và Public URL hoàn toàn chính xác!`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Lỗi khi test #${i + 1}:`, err.message);
    }
  }

  // 2. Tests upload qua URL
  console.log(`\n--- [PHẦN 2: TEST UPLOAD QUA URL (GIỮ ĐUÔI FILE GỐC)] ---`);
  // Dùng 1 URL ảnh gif công khai tiêu chuẩn (1x1 gif của W3C / Wikimedia)
  const urlTestCases = [
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png',
      expectedExt: '.png',
      expectedMime: 'image/png',
      folder: 'Test_Uploads/FromUrl',
    },
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif',
      expectedExt: '.gif',
      expectedMime: 'image/gif',
      folder: 'Test_Uploads/FromUrl',
    },
  ];

  for (let i = 0; i < urlTestCases.length; i++) {
    const tc = urlTestCases[i];
    console.log(`\n[Test URL #${i + 1}] Uploading từ URL: ${tc.url}`);

    try {
      const res = await uploadViaUrl(tc.url, tc.folder);
      const key = res.uploaded?.[0];
      const url = res.urls?.[0];
      uploadedKeys.push(key);

      console.log(`  ✓ Upload response:`, { key, url });

      const resultExt = path.extname(key).toLowerCase();
      if (resultExt === tc.expectedExt) {
        console.log(`  ✅ Đuôi file giữ nguyên đúng chuẩn: ${resultExt}`);
      } else {
        console.error(`  ❌ LỖI: Đuôi file bị đổi từ ${tc.expectedExt} thành ${resultExt}`);
      }

      if (url) {
        const head = await verifyPublicUrl(url);
        console.log(`  ✓ Public URL check: Status=${head.status}, Content-Type=${head.contentType}`);
        if (head.status === 200 && head.contentType === tc.expectedMime) {
          console.log(`  ✅ Content-Type trên CDN R2 chính xác: ${head.contentType}`);
        }
      }
    } catch (err) {
      console.error(`  ⚠️ Lỗi hoặc mạng không tải được URL ngoài (#${i + 1}):`, err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🧹 Đang dọn dẹp ${uploadedKeys.length} file test trên R2...`);
  for (const k of uploadedKeys) {
    await deleteR2Object(k);
    console.log(`  - Đã xóa test object: ${k}`);
  }
  console.log(`✨ HOÀN TẤT KIỂM TRA. TẤT CẢ FILE (LOCAL & URL) ĐỀU GIỮ NGUYÊN ĐUÔI GỐC! ✨`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    await runTargetTest(args[0], args[1]);
  } else {
    await runAutoTests();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
