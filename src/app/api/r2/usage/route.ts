import { NextRequest, NextResponse } from 'next/server';

/**
 * Cloudflare R2 Bucket Usage API
 * GET https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/usage
 * Requires CLOUDFLARE_API_TOKEN (API Token với quyền R2 read, khác với S3 credentials)
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  const expected = process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucketName = process.env.CLOUDFLARE_BUCKETNAME;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !bucketName || !apiToken) {
    return NextResponse.json(
      { error: 'Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_BUCKETNAME, or CLOUDFLARE_API_TOKEN' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/usage`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Cloudflare R2 usage API error:', res.status, err);
      return NextResponse.json(
        { error: `Cloudflare API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      success?: boolean;
      result?: {
        payloadSize?: string;
        metadataSize?: string;
        objectCount?: string;
        uploadCount?: string;
        end?: string;
      };
    };

    if (!data.success || !data.result) {
      return NextResponse.json({ error: 'Invalid response from Cloudflare' }, { status: 500 });
    }

    const payloadBytes = parseInt(data.result.payloadSize || '0', 10);
    const metadataBytes = parseInt(data.result.metadataSize || '0', 10);
    const totalBytes = payloadBytes + metadataBytes;

    return NextResponse.json({
      payloadSize: payloadBytes,
      metadataSize: metadataBytes,
      totalSize: totalBytes,
      objectCount: parseInt(data.result.objectCount || '0', 10),
      uploadCount: parseInt(data.result.uploadCount || '0', 10),
      end: data.result.end,
    });
  } catch (err) {
    console.error('R2 usage fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
