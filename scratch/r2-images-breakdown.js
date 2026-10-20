// Drill into Images/Sex/ — list top-N subfolders at multiple depths
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const BUCKET = 'storages';
const ROOT = process.argv[2] || 'Images/Sex/';
const TOP_N = 30;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
});

(async () => {
  const t0 = Date.now();
  console.log(`Scanning ${ROOT} ...`);
  const agg = new Map();   // level-1 subfolder -> {size, count}
  const agg2 = new Map();  // level-2 subfolder -> {size, count}
  const agg3 = new Map();  // level-3 subfolder -> {size, count}
  const extAgg = new Map();// extension -> {size, count}
  let token = null, pages = 0, total = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: ROOT,
      ContinuationToken: token,
      MaxKeys: 1000
    }));
    pages += 1;
    for (const o of (r.Contents || [])) {
      const rel = o.Key.slice(ROOT.length);
      const parts = rel.split('/');
      const l1 = parts[0] + '/';
      const l2 = (parts[1] ? parts[0] + '/' + parts[1] + '/' : '');
      const l3 = (parts[2] ? parts[0] + '/' + parts[1] + '/' + parts[2] + '/' : '');
      // aggregate
      const a1 = agg.get(l1) || { size: 0, count: 0 }; a1.size += o.Size; a1.count += 1; agg.set(l1, a1);
      if (l2) { const a2 = agg2.get(l2) || { size: 0, count: 0 }; a2.size += o.Size; a2.count += 1; agg2.set(l2, a2); }
      if (l3) { const a3 = agg3.get(l3) || { size: 0, count: 0 }; a3.size += o.Size; a3.count += 1; agg3.set(l3, a3); }
      // extension
      const lastName = parts[parts.length - 1];
      const dot = lastName.lastIndexOf('.');
      const ext = dot > 0 ? lastName.slice(dot + 1).toLowerCase() : '(none)';
      const aE = extAgg.get(ext) || { size: 0, count: 0 }; aE.size += o.Size; aE.count += 1; extAgg.set(ext, aE);
      total += 1;
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
    if (pages % 10 === 0) {
      process.stdout.write(`\r  pages=${pages}  files=${total}  elapsed=${((Date.now()-t0)/1000).toFixed(1)}s   `);
    }
  } while (token);
  process.stdout.write('\n');

  const print = (title, m, n = TOP_N) => {
    console.log(`\n=== ${title} ===`);
    const rows = [...m.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, n);
    const grand = rows.reduce((a, [, v]) => a + v.size, 0);
    for (const [k, v] of rows) {
      const mb = (v.size / 1024 / 1024).toFixed(2);
      const gb = (v.size / 1024 / 1024 / 1024).toFixed(3);
      const pct = grand ? ((v.size / grand) * 100).toFixed(1) : '0.0';
      console.log(`  ${k.padEnd(50)} ${gb.padStart(8)} GB  (${mb.padStart(10)} MB)  files=${String(v.count).padStart(7)}  ${pct}%`);
    }
    console.log(`  ${'(showing top ' + n + ' of ' + m.size + ')'.padEnd(50)}`);
  };

  print(`Level-1 subfolders of ${ROOT}`, agg, TOP_N);
  print(`Level-2 subfolders of ${ROOT}`, agg2, TOP_N);
  print(`Top 20 by file extension`, extAgg, 20);

  console.log(`\nTotal files: ${total}  |  pages: ${pages}  |  elapsed: ${((Date.now()-t0)/1000).toFixed(1)}s`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });