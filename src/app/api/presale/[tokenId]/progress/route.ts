import { NextResponse } from 'next/server';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';

const INDEXER_URL = getPublicIndexerUrl();

export async function GET(_req: Request, context: { params: Promise<{ tokenId: string }> }) {
  try {
    const { tokenId } = await context.params;

    const upstream = await fetch(`${INDEXER_URL}/api/presale/${encodeURIComponent(tokenId)}/progress`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    const responseText = await upstream.text();
    return new NextResponse(responseText, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}
