import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, deleteFolderByPrefix } from '@/server/r2';

// Create a zero-byte "folder" marker under parentPrefix
export async function POST(request: NextRequest) {
  try {
    const { parentPrefix = '', name } = (await request.json()) as { parentPrefix?: string; name: string };
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });
    }

    // Basic normalization: trim leading/trailing slashes, collapse multiple slashes
    const cleanedParent = String(parentPrefix || '').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    const trimmed = name.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
      return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
    }
    if (trimmed.includes('..')) {
      return NextResponse.json({ error: 'Invalid characters in name' }, { status: 400 });
    }

    const fullPrefix = (cleanedParent ? `${cleanedParent.replace(/\/+$/,'')}/` : '') + `${trimmed}/`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKETNAME!,
      Key: fullPrefix,
      Body: new Uint8Array(),
      ContentType: 'application/x-directory',
    });

    await s3Client.send(command);

    return NextResponse.json({ ok: true, prefix: fullPrefix });
  } catch (error: any) {
    console.error('Create folder failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create folder' }, { status: 500 });
  }
}

// Delete folder (all objects under prefix)
export async function DELETE(request: NextRequest) {
  try {
    const { prefix } = (await request.json()) as { prefix: string };
    if (!prefix || typeof prefix !== 'string') {
      return NextResponse.json({ error: 'Missing prefix' }, { status: 400 });
    }
    const normalized = prefix.replace(/^\/+|\/+$/g, '') ? prefix.replace(/^\/+|\/+$/g, '') + '/' : '';
    const { deleted } = await deleteFolderByPrefix(normalized);
    return NextResponse.json({ ok: true, deleted });
  } catch (error: any) {
    console.error('Delete folder failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete folder' }, { status: 500 });
  }
}

