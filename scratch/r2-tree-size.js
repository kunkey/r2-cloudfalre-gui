// R2 bucket analyzer using @aws-sdk/client-s3
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const BUCKET = 'storages';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: false
});

async function listAll(prefix, token = null, acc = []) {
  const cmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
    Delimiter: '/',
    ContinuationToken: token,
    MaxKeys: 1000
  });
  const out = await s3.send(cmd);
  if (out.CommonPrefixes) {
    for (const cp of out.CommonPrefixes) {
      await listAll(cp.Prefix, null, acc);
    }
  }
  if (out.Contents) {
    for (const obj of out.Contents) {
      if (!obj.Key.endsWith('/')) acc.push({ key: obj.Key, size: obj.Size });
    }
  }
  if (out.IsTruncated) {
    return listAll(prefix, out.NextContinuationToken, acc);
  }
  return acc;
}

(async () => {
  console.log('R2 Bucket:', BUCKET, '\n');

  // 1) Top-level listing with delimiter
  const top = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Delimiter: '/',
    MaxKeys: 1000
  }));

  const topPrefixes = (top.CommonPrefixes || []).map(p => p.Prefix);
  console.log('Top-level folders:');
  topPrefixes.forEach(p => console.log('  ' + p));
  console.log('Top-level files:', (top.Contents || []).length);

  // 2) Aggregate by top-level folder
  const agg = {};
  let grand = 0;
  let grandCount = 0;

  // include top-level files directly under bucket
  for (const obj of (top.Contents || [])) {
    if (obj.Key.endsWith('/')) continue;
    if (!agg['(root)']) agg['(root)'] = { size: 0, count: 0 };
    agg['(root)'].size += obj.Size;
    agg['(root)'].count += 1;
    grand += obj.Size;
    grandCount += 1;
  }

  for (const p of topPrefixes) {
    const items = await listAll(p);
    let size = 0, count = 0;
    for (const it of items) { size += it.size; count += 1; }
    if (!agg[p]) agg[p] = { size: 0, count: 0 };
    agg[p].size += size;
    agg[p].count += count;
    grand += size;
    grandCount += count;
  }

  console.log('\n=== Aggregate by top-level folder ===');
  const rows = Object.entries(agg).sort((a, b) => b[1].size - a[1].size);
  for (const [k, v] of rows) {
    const mb = (v.size / 1024 / 1024).toFixed(2);
    const gb = (v.size / 1024 / 1024 / 1024).toFixed(3);
    const pct = grand ? ((v.size / grand) * 100).toFixed(1) : '0.0';
    console.log(`  ${k.padEnd(40)} ${gb.padStart(8)} GB  (${mb.padStart(10)} MB)  files=${String(v.count).padStart(6)}  ${pct}%`);
  }

  console.log('\n=== GRAND TOTAL ===');
  console.log(`  Size:   ${(grand / 1024 / 1024).toFixed(2)} MB = ${(grand / 1024 / 1024 / 1024).toFixed(3)} GB`);
  console.log(`  Files:  ${grandCount}`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });