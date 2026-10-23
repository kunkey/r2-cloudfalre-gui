// Dry-run first: read JSON, group by extension, show top offenders, then a "destructive" mode.
// Usage:
//   node r2-delete-from-json.js <export.json> [--apply] [--limit N] [--ext webp,jpg]
//
// Safety: by default runs in DRY-RUN mode. Add --apply to actually issue DELETE requests.

const { S3Client, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const BUCKET = 'storages';

const args = process.argv.slice(2);
const jsonPath = args[0];
const apply = args.includes('--apply');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx > -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const extIdx = args.indexOf('--ext');
const extFilter = extIdx > -1 ? args[extIdx + 1].split(',').map(s => s.trim().toLowerCase()) : null;
const keysIdx = args.indexOf('--keys-file');
const keysFile = keysIdx > -1 ? args[keysIdx + 1] : null;

if (!jsonPath || jsonPath.startsWith('--')) {
  console.error('Usage: node r2-delete-from-json.js <export.json> [--apply] [--limit N] [--ext webp,jpg] [--keys-file keys.txt]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let targets = data.items.filter(it => !it.Key.endsWith('/'));
if (extFilter) {
  targets = targets.filter(it => {
    const e = (it.Key.split('.').pop() || '').toLowerCase();
    return extFilter.includes(e);
  });
}
if (keysFile) {
  const allow = new Set(fs.readFileSync(keysFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  targets = targets.filter(it => allow.has(it.Key));
}
if (limit > 0) targets = targets.slice(0, limit);

const totalBytes = targets.reduce((a, x) => a + x.Size, 0);
console.log(`Source:        ${jsonPath}`);
console.log(`Bucket:        ${BUCKET}`);
console.log(`Matched items: ${targets.length}`);
console.log(`Total size:    ${(totalBytes/1024/1024).toFixed(2)} MB  (${(totalBytes/1024/1024/1024).toFixed(3)} GB)`);
console.log(`Mode:          ${apply ? 'APPLY (REAL DELETE)' : 'DRY-RUN'}`);

const extSummary = {};
for (const it of targets) {
  const e = (it.Key.split('.').pop() || '').toLowerCase();
  const cur = extSummary[e] || { count: 0, size: 0 };
  cur.count += 1; cur.size += it.Size;
  extSummary[e] = cur;
}
console.log('\nBy extension:');
for (const [e, v] of Object.entries(extSummary).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  .${e.padEnd(6)} files=${String(v.count).padStart(7)}  size=${(v.size/1024/1024).toFixed(2)} MB`);
}

if (targets.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}

console.log('\nFirst 10 keys:');
targets.slice(0, 10).forEach(t => console.log(`  ${(t.Size/1024).toFixed(1).padStart(8)} KB  ${t.Key}`));

if (!apply) {
  console.log('\n*** DRY-RUN — no changes made. Re-run with --apply to delete. ***');
  process.exit(0);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
});

(async () => {
  // Batch delete: 1000 per request
  const BATCH = 1000;
  let deleted = 0, bytesFreed = 0, errors = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    try {
      const out = await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map(c => ({ Key: c.Key })), Quiet: false }
      }));
      const errs = out.Errors || [];
      errors += errs.length;
      for (const e of errs) console.error('  ERR', e.Key, e.Code, e.Message);
      // successful deletes -- we trust the request unless in Errors
      const okCount = chunk.length - errs.length;
      deleted += okCount;
      for (const c of chunk) if (!errs.find(e => e.Key === c.Key)) bytesFreed += c.Size;
      process.stdout.write(`\r  deleted ${deleted}/${targets.length}  (~${(bytesFreed/1024/1024/1024).toFixed(2)} GB)  errors=${errors}   `);
    } catch (e) {
      errors += chunk.length;
      console.error('\n  BATCH ERR', e.message || e);
    }
  }
  process.stdout.write('\n');
  console.log(`\nDone. Deleted ${deleted} objects (~${(bytesFreed/1024/1024/1024).toFixed(3)} GB). Errors: ${errors}.`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });