import { NextResponse } from 'next/server';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';

const INDEXER_URL = getPublicIndexerUrl();
  const INTERNAL_KEY = process.env.INTERNAL_API_KEY || process.env.INDEXER_INTERNAL_KEY || '';

export async function POST(req: Request, context: { params: Promise<{ tokenId: string }> }) {
  try {
    const { tokenId } = (context as unknown as { params: { tokenId: string } }).params;
    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key') || '';
    const bodyText = await req.text();

    const upstream = await fetch(`${INDEXER_URL}/api/tokens/${encodeURIComponent(tokenId)}/settle`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...(INTERNAL_KEY ? { 'x-internal-key': INTERNAL_KEY } : {}),
      },
      body: bodyText,
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
