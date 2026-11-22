// ============================================================
// r2-cleanup.js — Chuẩn bị cleanup file rác trong R2
// ============================================================
//
// Cách dùng:
//   node r2-cleanup.js
//     → Step 1: Phân tích toàn bộ R2, export tất cả keys
//
//   node r2-cleanup.js --step2
//     → Step 2: Đọc keep-unikeys.txt, so khớp, xuất delete-candidates.txt
//
//   node r2-cleanup.js --apply
//     → Step 3: Thực thi xóa (dry-run mặc định, thêm --apply để xóa thật)
//
//   node r2-cleanup.js --dry
//     → Chỉ hiển thị preview (không xóa, không ghi file)
//
// Files cần chuẩn bị:
//   keep-unikeys.txt  – 1 unikey mỗi dòng (KHÔNG có prefix Images/Sex/)
//   skip-dirs.txt     – thư mục bỏ qua (1 dòng mỗi dir, ví dụ: Images/Users/, Images/Ads/)
// ============================================================

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const BUCKET = 'storages';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
});

// ─── Helpers ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    step2: args.includes('--step2'),
    dry: args.includes('--dry') || (!args.includes('--apply')),
    apply: args.includes('--apply'),
    dryOnly: args.includes('--dry'),
    combined: args.includes('--combined'),
    source: args.find(a => a.startsWith('--source='))?.split('=')[1] || 'r2-full-export.json',
    outPrefix: args.find(a => a.startsWith('--out='))?.split('=')[1] || '',
    exportPrefix: args.find(a => a.startsWith('--prefix='))?.split('=')[1] || null,
    skipDirs: readLines('scratch/skip-dirs.txt'),
    keepUnikeys: readLines('scratch/keep-unikeys.txt'),
  };
}

function readLines(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('#'))
  );
}

function extractUnikey(key) {
  // key dạng: Images/Sex/1765191393187-nc-2597-jlpro2qwspfg.jpg
  // unikey = phần sau dấu / cuối, bỏ extension
  const filename = key.split('/').pop();
  const dot = filename.lastIndexOf('.');
  const base = dot > -1 ? filename.slice(0, dot) : filename;
  // Nếu có timestamp-prefix: bỏ timestamp (13-14 số đầu)
  const m = base.match(/^(\d{10,})-(.+)$/);
  if (m) return m[2];
  return base;
}

function classifyUnikey(uk) {
  if (/^DLDSS-\d+$/i.test(uk)) return 'DLDSS';
  if (/^SKU\d+/i.test(uk)) return 'SKU';
  if (/^[a-f0-9]{32}$/i.test(uk)) return 'md5';
  if (/^pasted-\d+/.test(uk)) return 'pasted';
  if (/^ok/i.test(uk)) return 'ok-video';
  if (/^1[789]\d{12,}$/.test(uk)) return 'social-id';
  if (/^[0-9a-f-]{36}$/i.test(uk)) return 'uuid';
  if (/_[a-f0-9]{32}$/i.test(uk)) return 'uuid_hash';
  if (/^[\w.-]+$/.test(uk) && uk.length < 60) return 'readable';
  return 'other';
}

async function listAll(prefix) {
  const items = [];
  let token = null, pages = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix || undefined,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    pages++;
    for (const o of (r.Contents || [])) {
      items.push({ Key: o.Key, Size: o.Size, LastModified: o.LastModified, ETag: (o.ETag || '').replace(/"/g, '') });
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
    if (pages % 20 === 0) process.stdout.write(`\r  prefix="${prefix||'(root)'}" pages=${pages} items=${items.length}   `);
  } while (token);
  process.stdout.write(`\r  prefix="${prefix||'(root)'}" pages=${pages} items=${items.length}   \n`);
  return items;
}

// ─── Step 1: Export toàn bộ R2 ───────────────────────────────────────

async function step1() {
  console.log('\n═══════════════════════════════════════');
  console.log('  STEP 1: Export toàn bộ R2 → r2-full-export.json');
  console.log('═══════════════════════════════════════\n');

  const t0 = Date.now();
  const items = await listAll(null);
  const totalBytes = items.reduce((a, x) => a + x.Size, 0);

  // Phân tích top-level
  const topLevel = {};
  for (const it of items) {
    const top = it.Key.split('/')[0] + '/';
    topLevel[top] = (topLevel[top] || 0) + it.Size;
  }

  console.log('\n── Top-level folders ──');
  for (const [k, v] of Object.entries(topLevel).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${(v / 1024 / 1024 / 1024).toFixed(3)} GB`);
  }

  const summary = {
    bucket: BUCKET,
    count: items.length,
    totalBytes,
    totalGB: +(totalBytes / 1024 / 1024 / 1024).toFixed(4),
    exportedAt: new Date().toISOString(),
  };

  fs.writeFileSync('r2-full-export.json', JSON.stringify({ summary, items }, null, 2));
  console.log(`\n✓ Wrote r2-full-export.json (${items.length} objects, ${summary.totalGB} GB)`);
  console.log(`  Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ─── Step 2: So khớp keep-unikeys → xuất candidates ─────────────────

function step2(opts) {
  console.log('\n═══════════════════════════════════════');
  console.log('  STEP 2: So khớp keep-unikeys → delete-candidates');
  console.log('═══════════════════════════════════════\n');

  if (!fs.existsSync(opts.source)) {
    console.error(`✗ Chưa có ${opts.source}. Chạy \`node r2-cleanup.js --source=export-images-sex.json --step2\` hoặc tạo r2-full-export.json trước.`);
    process.exit(1);
  }

  const { items } = JSON.parse(fs.readFileSync(opts.source, 'utf8'));
  const keepUnikeys = opts.keepUnikeys;
  const skipDirs = opts.skipDirs;

  console.log(`  keep-unikeys: ${keepUnikeys.size} entries`);
  console.log(`  skip-dirs:    ${skipDirs.size > 0 ? [...skipDirs].join(', ') : '(none)'}`);
  console.log(`  total items:  ${items.length}`);

  // Phân loại trước
  const stats = {};
  const keep = [], discard = [], skipped = [];

  for (const it of items) {
    // Check skip dirs
    if (skipDirs.size > 0) {
      const matchedSkip = [...skipDirs].find(s => it.Key.startsWith(s));
      if (matchedSkip) { skipped.push(it); stats[matchedSkip] = (stats[matchedSkip] || 0) + it.Size; continue; }
    }

    const uk = extractUnikey(it.Key);
    if (keepUnikeys.has(uk)) {
      keep.push(it);
    } else {
      discard.push({ ...it, unikey: uk, classification: classifyUnikey(uk) });
    }
  }

  console.log(`\n  Keep:     ${keep.length}`);
  console.log(`  Discard:  ${discard.length}`);
  console.log(`  Skipped:  ${skipped.length}`);

  // Phân tích discard theo classification
  const byClass = {};
  for (const d of discard) {
    const c = d.classification;
    if (!byClass[c]) byClass[c] = { count: 0, bytes: 0 };
    byClass[c].count++;
    byClass[c].bytes += d.Size;
  }
  console.log('\n  ── Discard breakdown by classification ──');
  for (const [c, v] of Object.entries(byClass).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${String(v.count).padStart(7)} files  ${(v.bytes / 1024 / 1024).toFixed(2).padStart(10)} MB  ${c}`);
  }

  // Xuất delete-candidates.json
  const outPrefix = opts.outPrefix;
  const candidatesFile = outPrefix ? `scratch/delete-candidates${outPrefix}.json` : 'scratch/delete-candidates.json';
  const keysFile = outPrefix ? `scratch/delete-candidates${outPrefix}-keys.txt` : 'scratch/delete-candidates-keys.txt';
  const previewFile = outPrefix ? `scratch/delete-candidates${outPrefix}-preview.json` : 'scratch/delete-candidates-preview.json';
  const discardGB = +(discard.reduce((a, x) => a + x.Size, 0) / 1024 / 1024 / 1024).toFixed(4);

  const deleteCandidates = {
    summary: {
      totalItems: items.length,
      keepCount: keep.length,
      discardCount: discard.length,
      skippedCount: skipped.length,
      discardBytes: discard.reduce((a, x) => a + x.Size, 0),
      discardGB,
      sourcePrefix: opts.source,
    },
    discardByClass: byClass,
    items: discard,
  };
  fs.writeFileSync(candidatesFile, JSON.stringify(deleteCandidates, null, 2));
  console.log(`\n✓ Wrote ${candidatesFile} (${discard.length} candidates, ${discardGB} GB)`);

  // Xuất keys để delete
  fs.writeFileSync(keysFile, discard.map(d => d.Key).join('\n') + '\n');
  console.log(`✓ Wrote ${keysFile}`);

  // Xuất summary riêng để review nhanh
  const preview = discard.slice(0, 20).map(d => ({
    unikey: d.unikey,
    class: d.classification,
    sizeKB: +((d.Size / 1024).toFixed(1)),
    key: d.Key,
  }));
  fs.writeFileSync(previewFile, JSON.stringify(preview, null, 2));
  console.log(`✓ Wrote ${previewFile} (top 20)`);

  console.log(`\n  → Bước tiếp: review delete-candidates.json`);
  console.log(`  → Sau khi OK: node r2-cleanup.js --apply`);
  console.log(`  → Dry-run:   node r2-cleanup.js --dry`);
}

// ─── Step 3: Apply delete ────────────────────────────────────────────

async function step3(opts, apply) {
  console.log('\n═══════════════════════════════════════');
  console.log(`  STEP 3: ${apply ? 'APPLY DELETE' : 'DRY-RUN DELETE'}`);
  console.log('═══════════════════════════════════════\n');

  let items, summary;

  if (opts.combined) {
    const combined = JSON.parse(fs.readFileSync('scratch/delete-candidates-combined.json', 'utf8'));
    items = combined.items;
    summary = combined.summary;
    console.log(`  Mode:       Combined (Sex + Cast)`);
  } else if (fs.existsSync('delete-candidates.json')) {
    const d = JSON.parse(fs.readFileSync('delete-candidates.json', 'utf8'));
    items = d.items;
    summary = d.summary;
    console.log(`  Source:     delete-candidates.json`);
  } else {
    console.error('✗ Chưa có delete-candidates.json. Chạy `node r2-cleanup.js --step2` trước.');
    process.exit(1);
  }

  // Checkpoint: load already-deleted keys
  const doneKeys = new Set();
  const ckptFile = 'scratch/delete-done-keys.json';
  if (fs.existsSync(ckptFile)) {
    const done = JSON.parse(fs.readFileSync(ckptFile, 'utf8'));
    for (const k of done) doneKeys.add(k);
  }
  if (doneKeys.size > 0) {
    console.log(`  Resume:     ${doneKeys.size} items already deleted — skipping`);
    items = items.filter(it => !doneKeys.has(it.Key));
    console.log(`  Remaining:  ${items.length} items to delete`);
  }

  console.log(`  Candidates: ${items.length}  |  Size: ${summary.discardGB} GB`);
  console.log(`  Action:    ${apply ? 'REAL DELETE' : 'DRY-RUN'}`);
  if (apply) console.log('  ⏱️  Press Ctrl+C trong 3s để hủy...');
  if (apply) await new Promise(r => setTimeout(r, 3000));

  if (!apply) {
    console.log('\n  (First 10 would be deleted:)');
    for (const it of items.slice(0, 10)) console.log(`    ${it.Key}`);
    console.log('\n*** DRY-RUN — no changes made. Re-run with --apply --combined to delete. ***');
    return;
  }

  // Batch delete: 1000 per request
  const BATCH = 1000;
  let deleted = 0, bytesFreed = 0, errors = 0;
  const errorLog = [];
  const done = [...doneKeys]; // accumulate

  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    try {
      const out = await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map(c => ({ Key: c.Key })), Quiet: true }
      }));
      const errs = out.Errors || [];
      for (const e of errs) { errorLog.push(e); errors++; }
      const okCount = chunk.length - errs.length;
      deleted += okCount;
      for (const c of chunk) {
        if (!errs.find(e => e.Key === c.Key)) {
          bytesFreed += c.Size;
          done.push(c.Key);
        }
      }
      // Save checkpoint every 5000 items
      if (done.length % 5000 < BATCH) {
        fs.writeFileSync(ckptFile, JSON.stringify(done));
        process.stdout.write(` [checkpoint saved]`);
      }
      process.stdout.write(`\r  deleted ${deleted}/${items.length}  (~${(bytesFreed/1024/1024/1024).toFixed(2)} GB)  errors=${errors}   `);
    } catch (e) {
      errors += chunk.length;
      console.error(`\n  BATCH ERR: ${e.message}`);
    }
  }
  process.stdout.write('\n');
  fs.writeFileSync(ckptFile, JSON.stringify(done));
  console.log(`\n✓ Done. Deleted ${deleted} objects (~${(bytesFreed/1024/1024/1024).toFixed(3)} GB). Errors: ${errors}.`);
  if (errorLog.length) {
    fs.writeFileSync('delete-errors.json', JSON.stringify(errorLog, null, 2));
    console.log(`  Wrote delete-errors.json (${errorLog.length} errors)`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

(async () => {
  const opts = parseArgs();

  if (process.argv.includes('--step2')) {
    step2(opts);
    return;
  }

  if (opts.apply) {
    await step3(opts, true);
    return;
  }

  if (opts.dry || opts.combined) {
    await step3(opts, false);
    return;
  }

  // Default: step1
  await step1();
  console.log('\n  Tiếp theo: chạy `node r2-cleanup.js --source=scratch/export-images-sex.json --step2` để so khớp keep-unikeys.txt');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
