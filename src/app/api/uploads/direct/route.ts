import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/server/r2';
import { checkApiAuth } from '@/server/auth';

function getExtension(name: string): string {
  const clean = name.split(/[?#]/)[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot > 0 && lastDot < clean.length - 1) {
    return clean.slice(lastDot + 1).toLowerCase();
  }
  return '';
}

function inferExtensionFromBuffer(buf: Uint8Array | Buffer): string | null {
  if (!buf || buf.length < 4) return null;
  // GIF: GIF87a or GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'gif';
  }
  // PNG: \x89PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  // JPEG: \xff\xd8\xff
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }
  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'webp';
  }
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'pdf';
  }
  // ZIP: PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return 'zip';
  }
  // MP4: ....ftyp
  if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return 'mp4';
  }
  return null;
}

function resolveMimeType(key: string, providedType?: string): string {
  const ext = getExtension(key);
  const mimeMap: Record<string, string> = {
    // Images
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    // Documents & archives
    pdf: 'application/pdf',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    json: 'application/json',
    xml: 'application/xml',
    txt: 'text/plain',
    csv: 'text/csv',
  };

  if (ext && mimeMap[ext]) {
    return mimeMap[ext];
  }
  if (providedType && providedType !== 'application/octet-stream') {
    return providedType;
  }
  return 'application/octet-stream';
}

function resolveKey(originalName: string, explicitKey?: string, folder?: string): string {
  const originalExt = getExtension(originalName);

  let key = (explicitKey || '').trim().replace(/^\/+/, '');

  if (!key) {
    const cleanFolder = (folder || '').trim().replace(/^\/+|\/+$/g, '');
    key = cleanFolder ? `${cleanFolder}/${originalName}` : originalName;
  } else if (key.endsWith('/')) {
    key = `${key}${originalName}`;
  } else {
    // If key has no extension but original file has one, keep the original extension
    const keyExt = getExtension(key);
    if (!keyExt && originalExt) {
      key = `${key}.${originalExt}`;
    }
  }

  return key.replace(/^\/+/, '');
}

function resolveFileNameFromUrl(
  urlStr: string,
  buffer: Buffer,
  contentType?: string,
  contentDisposition?: string
): string {
  let rawName = '';

  // 1. Content-Disposition header
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
    if (match && match[1]) {
      try {
        rawName = decodeURIComponent(match[1].trim());
      } catch {
        rawName = match[1].trim();
      }
    }
  }

  // 2. URL Pathname
  if (!rawName) {
    try {
      const u = new URL(urlStr);
      const lastSeg = u.pathname.split('/').filter(Boolean).pop() || '';
      if (lastSeg) {
        try {
          rawName = decodeURIComponent(lastSeg);
        } catch {
          rawName = lastSeg;
        }
      }
      if (!rawName.includes('.')) {
        for (const p of ['file', 'filename', 'name', 'img', 'image']) {
          const val = u.searchParams.get(p);
          if (val && val.includes('.')) {
            rawName = val;
            break;
          }
        }
      }
    } catch {}
  }

  // 3. Detect extension
  let ext = getExtension(rawName);

  // Magic bytes inspection
  const magicExt = inferExtensionFromBuffer(buffer);
  if (!ext && magicExt) {
    ext = magicExt;
  } else if (magicExt && ext && ['bin', 'download', 'tmp', 'octet'].includes(ext)) {
    ext = magicExt;
  }

  // Fallback to Content-Type header
  if (!ext && contentType) {
    const cleanCt = contentType.split(';')[0].trim().toLowerCase();
    const mimeMap: Record<string, string> = {
      'image/gif': 'gif',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/x-icon': 'ico',
      'image/avif': 'avif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'application/json': 'json',
      'text/plain': 'txt',
    };
    if (mimeMap[cleanCt]) {
      ext = mimeMap[cleanCt];
    } else if (cleanCt.startsWith('image/')) {
      ext = cleanCt.slice(6).split('+')[0] || 'jpg';
    } else if (cleanCt.startsWith('video/')) {
      ext = cleanCt.slice(6).split('+')[0] || 'mp4';
    }
  }

  if (!ext) ext = 'bin';

  let stem = 'file';
  if (rawName) {
    const dotIdx = rawName.lastIndexOf('.');
    stem = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
  }
  stem = stem.replace(/[^\w.\-()\[\] \u00C0-\u024F]+/g, '_').trim() || `import-${Date.now()}`;

  return `${stem}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = checkApiAuth(request);
    if (unauthorized) return unauthorized;

    const contentTypeHeader = request.headers.get('content-type') || '';
    const isJson = contentTypeHeader.includes('application/json');

    const bucket = process.env.CLOUDFLARE_BUCKETNAME!;
    const publicBase = (
      process.env.CLOUDFLARE_BUCKET_URL ||
      process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC ||
      ''
    ).replace(/\/+$/, '');

    const itemsToUpload: { buffer: Buffer; key: string; contentType: string }[] = [];

    if (isJson) {
      // JSON body: { url, urls, key, folder }
      const body = (await request.json()) as any;
      const rawUrls: string[] = [];
      if (typeof body?.url === 'string') rawUrls.push(body.url);
      if (Array.isArray(body?.urls)) rawUrls.push(...body.urls.filter((u: any) => typeof u === 'string'));

      if (rawUrls.length === 0) {
        return NextResponse.json({ error: 'No url or urls provided' }, { status: 400 });
      }

      const folder = (body?.folder || body?.prefix || '') as string;
      const explicitKeys = Array.isArray(body?.keys) ? body.keys : (body?.key ? [body.key] : []);

      await Promise.all(
        rawUrls.map(async (u, idx) => {
          const fetchRes = await fetch(u, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (!fetchRes.ok) {
            throw new Error(`Failed to download URL: ${u} (HTTP ${fetchRes.status})`);
          }
          const buf = Buffer.from(await fetchRes.arrayBuffer());
          const remoteCt = fetchRes.headers.get('content-type') || undefined;
          const remoteCd = fetchRes.headers.get('content-disposition') || undefined;

          const resolvedName = resolveFileNameFromUrl(u, buf, remoteCt, remoteCd);
          const key = resolveKey(resolvedName, explicitKeys[idx], folder);
          const ct = resolveMimeType(key, remoteCt);

          itemsToUpload.push({ buffer: buf, key, contentType: ct });
        })
      );
    } else {
      // FormData body
      const form = await request.formData();
      const rawFiles = form.getAll('file').concat(form.getAll('files'));
      const files = rawFiles.filter((item): item is File => typeof item === 'object' && 'arrayBuffer' in item);

      // Also support 'url' or 'urls' inside FormData!
      const rawUrls = (form.getAll('url').concat(form.getAll('urls')) as string[]).filter(Boolean);

      if (files.length === 0 && rawUrls.length === 0) {
        return NextResponse.json({ error: 'No files or urls provided' }, { status: 400 });
      }

      const rawKeys = form.getAll('key').concat(form.getAll('keys')) as string[];
      const folder = (form.get('folder') || form.get('prefix') || '') as string;

      // 1. Process files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const key = resolveKey(file.name || 'file', rawKeys[i], folder);
        const buf = Buffer.from(await file.arrayBuffer());
        // Inspect magic bytes to prevent mislabeled files
        const magicExt = inferExtensionFromBuffer(buf);
        let finalKey = key;
        const currentExt = getExtension(key);
        if (!currentExt && magicExt) {
          finalKey = `${key}.${magicExt}`;
        }
        const ct = resolveMimeType(finalKey, file.type);
        itemsToUpload.push({ buffer: buf, key: finalKey, contentType: ct });
      }

      // 2. Process URLs in form data
      if (rawUrls.length > 0) {
        const keyOffset = files.length;
        await Promise.all(
          rawUrls.map(async (u, idx) => {
            const fetchRes = await fetch(u, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            });
            if (!fetchRes.ok) {
              throw new Error(`Failed to download URL: ${u} (HTTP ${fetchRes.status})`);
            }
            const buf = Buffer.from(await fetchRes.arrayBuffer());
            const remoteCt = fetchRes.headers.get('content-type') || undefined;
            const remoteCd = fetchRes.headers.get('content-disposition') || undefined;

            const resolvedName = resolveFileNameFromUrl(u, buf, remoteCt, remoteCd);
            const key = resolveKey(resolvedName, rawKeys[keyOffset + idx], folder);
            const ct = resolveMimeType(key, remoteCt);

            itemsToUpload.push({ buffer: buf, key, contentType: ct });
          })
        );
      }
    }

    // Upload all items to S3/R2
    await Promise.all(
      itemsToUpload.map(async (item) => {
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: item.buffer,
          ContentType: item.contentType,
          ContentLength: item.buffer.length,
        });
        await s3Client.send(command);
      })
    );

    const resolvedKeys = itemsToUpload.map((i) => i.key);
    const urls = resolvedKeys.map((k) => {
      const cleanKey = k.replace(/^\/+/, '');
      const encoded = encodeURIComponent(cleanKey).replace(/%2F/g, '/');
      return publicBase ? `${publicBase}/${encoded}` : `/${cleanKey}`;
    });

    return NextResponse.json({
      uploaded: resolvedKeys,
      urls,
      count: resolvedKeys.length,
    });
  } catch (error: any) {
    console.error('Direct upload failed:', error);
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 });
  }
}



