import { NextResponse } from 'next/server';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';

const INDEXER_URL = getPublicIndexerUrl();

export async function GET() {
  try {
    const upstream = await fetch(`${INDEXER_URL}/api/presale/tokens`, {
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
