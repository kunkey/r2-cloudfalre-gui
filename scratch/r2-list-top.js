// R2 ListBucket helper - pure Node.js, AWS SigV4
const crypto = require('crypto');

const ACCESS_KEY = 'c5ae692f82d3f8929765283328679e23';
const SECRET_KEY = 'a771a76b70b59a87c88af1240450a086ae27d000376f4740628a4108ea071ed6';
const ACCOUNT_ID = 'd4a15171fc12622c9292f8aa0d897594';
const BUCKET = 'storages';
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const REGION = 'auto';
const SERVICE = 's3';

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hex(buf) {
  return buf.toString('hex');
}

async function signedFetch(method, path, query) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  // SigV4: canonical query string must be RFC 3986 encoded, params sorted by name
  const canonicalQueryString = canonicalizeQueryString(query);

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const kDate = hmac('AWS4' + SECRET_KEY, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hex(hmac(kSigning, stringToSign));

  const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${ENDPOINT}${path}?${canonicalQueryString}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': auth,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash
    }
  });
  return res;
}

// SigV4 canonical query string:
//   1. URI-encode each name and value per RFC 3986 (unreserved = A-Z a-z 0-9 - . _ ~)
//   2. Sort params by encoded name
//   3. Join name=value pairs with &, each name and value joined with =
function canonicalizeQueryString(query) {
  const pairs = query.split('&').filter(Boolean);
  const enc = (s) => encodeURIComponent(s)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const normalized = pairs.map(p => {
    const eq = p.indexOf('=');
    if (eq === -1) return { name: enc(p), value: '' };
    return { name: enc(p.slice(0, eq)), value: enc(p.slice(eq + 1)) };
  });
  normalized.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return normalized.map(p => `${p.name}=${p.value}`).join('&');
}

function parseXml(xml) {
  // minimal XML to JS - we only need ListBucketResult fields
  const result = { CommonPrefixes: [], Contents: [] };
  const rootMatch = xml.match(/<ListBucketResult[^>]*>([\s\S]*?)<\/ListBucketResult>/);
  if (!rootMatch) return result;
  const body = rootMatch[1];
  const get = (tag) => {
    const m = body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m ? m[1] : null;
  };
  result.IsTruncated = get('IsTruncated') === 'true';
  result.KeyCount = parseInt(get('KeyCount') || '0', 10);
  result.MaxKeys = parseInt(get('MaxKeys') || '0', 10);
  const prefixes = [...body.matchAll(/<Prefix>([^<]*)<\/Prefix>/g)];
  result.CommonPrefixes = prefixes.map(m => m[1]);
  const contents = [...body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
  result.Contents = contents.map(m => {
    const c = m[1];
    const g = (t) => { const x = c.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return x ? x[1] : ''; };
    return { Key: g('Key'), Size: parseInt(g('Size') || '0', 10), LastModified: g('LastModified') };
  });
  return result;
}

async function listPrefix(prefix, continuationToken = null) {
  const queryParts = ['list-type=2'];
  if (prefix) queryParts.push(`prefix=${encodeURIComponent(prefix)}`);
  if (continuationToken) queryParts.push(`continuation-token=${encodeURIComponent(continuationToken)}`);
  queryParts.push('delimiter=/');
  const query = queryParts.join('&');
  const res = await signedFetch('GET', `/${BUCKET}`, query);
  const xml = await res.text();
if (!res.ok) {
    console.error('HTTP', res.status, xml.slice(0, 4000));
    throw new Error(`List failed: ${res.status}`);
  }
  return parseXml(xml);
}

async function main() {
  // 1) top-level listing
  console.log('=== Top-level prefixes in R2 bucket:', BUCKET, '===');
  let data = await listPrefix('');
  data.CommonPrefixes.forEach(p => console.log('  ' + p));

  // 2) Walk each prefix recursively and sum sizes
  const totals = []; // { prefix, size, count }
  let prefixList = data.CommonPrefixes.slice();

  // BFS to handle nested prefixes
  let safety = 1000;
  while (prefixList.length && safety-- > 0) {
    const next = [];
    for (const p of prefixList) {
      let token = null;
      let totalSize = 0;
      let totalCount = 0;
      do {
        const sub = await listPrefix(p, token);
        totalSize += sub.Contents.reduce((a, c) => a + c.Size, 0);
        totalCount += sub.Contents.length;
        sub.Contents.forEach(c => totals.push({ prefix: p, key: c.Key, size: c.Size }));
        next.push(...sub.CommonPrefixes);
        token = sub.IsTruncated ? sub.Contents[sub.Contents.length - 1].Key : null;
      } while (token);
      console.log(`  ${p}  total=${(totalSize/1024/1024).toFixed(2)} MB, files=${totalCount}`);
    }
    // de-dupe nested
    prefixList = [...new Set(next)];
  }

  // 3) Final aggregate by top-level prefix
  console.log('\n=== Aggregate by top-level folder ===');
  const agg = {};
  for (const r of totals) {
    const top = r.prefix.replace(/\/$/, '').split('/')[0] + '/';
    if (!agg[top]) agg[top] = { size: 0, count: 0 };
    agg[top].size += r.size;
    agg[top].count += 1;
  }
  const grandTotal = Object.values(agg).reduce((a, x) => a + x.size, 0);
  Object.entries(agg)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([k, v]) => {
      const mb = (v.size / 1024 / 1024).toFixed(2);
      const gb = (v.size / 1024 / 1024 / 1024).toFixed(3);
      const pct = grandTotal ? ((v.size / grandTotal) * 100).toFixed(1) : '0.0';
      console.log(`  ${k.padEnd(40)} ${gb.padStart(8)} GB (${mb.padStart(10)} MB)  files=${String(v.count).padStart(6)}  ${pct}%`);
    });

  console.log('\n=== GRAND TOTAL ===');
  console.log(`  Size: ${(grandTotal / 1024 / 1024).toFixed(2)} MB = ${(grandTotal / 1024 / 1024 / 1024).toFixed(3)} GB`);
  console.log(`  Total files: ${totals.length}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });