// Export R2 object list to JSON for mapping/review
// Usage: node r2-export.js [prefix] [outFile]
//   prefix  default = '' (whole bucket)
//   outFile default = r2-export-<timestamp>.json

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');

const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const BUCKET = 'storages';

const PREFIX = process.argv[2] || '';
const OUT = process.argv[3] || `r2-export-${PREFIX.replace(/[/\\:]/g, '_')}-${Date.now()}.json`;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
});

(async () => {
  const t0 = Date.now();
  console.log(`Listing bucket="${BUCKET}" prefix="${PREFIX || '(all)'}"`);
  const items = [];
  let token = null, pages = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX || undefined,
      ContinuationToken: token,
      MaxKeys: 1000
    }));
    pages += 1;
    for (const o of (r.Contents || [])) {
      items.push({
        Key: o.Key,
        Size: o.Size,
        LastModified: o.LastModified,
        ETag: (o.ETag || '').replace(/"/g, ''),
        StorageClass: o.StorageClass || 'STANDARD'
      });
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
    if (pages % 10 === 0) {
      process.stdout.write(`\r  pages=${pages}  files=${items.length}  elapsed=${((Date.now()-t0)/1000).toFixed(1)}s   `);
    }
  } while (token);
  process.stdout.write('\n');

  const totalSize = items.reduce((a, x) => a + x.Size, 0);
  const summary = {
    bucket: BUCKET,
    prefix: PREFIX,
    count: items.length,
    totalBytes: totalSize,
    totalMB: +(totalSize / 1024 / 1024).toFixed(2),
    totalGB: +(totalSize / 1024 / 1024 / 1024).toFixed(4),
    exportedAt: new Date().toISOString(),
    pages
  };

  const out = { summary, items };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Files: ${summary.count} | Size: ${summary.totalGB} GB | Elapsed: ${((Date.now()-t0)/1000).toFixed(1)}s`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });