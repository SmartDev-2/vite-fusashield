import { clientIp, handle, json, limit, predictionsFbGet, preflight } from '../../server/lib.js';

export async function GET(request) {
  return handle(async () => {
    limit(`predictions:history:${clientIp(request)}`, 30, 60_000);
    const url = new URL(request.url);
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '30', 10);
    const count = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 30;
    const history = await predictionsFbGet('predictions/history', {
      orderBy: '"$key"',
      limitToLast: String(count),
    });

    const items = Object.entries(history || {})
      .filter(([, record]) => record && typeof record === 'object')
      .map(([id, record]) => ({ ...record, history_id: record.history_id || id }))
      .sort((a, b) => (Date.parse(b.processed_at || '') || 0) - (Date.parse(a.processed_at || '') || 0));

    return json({ count: items.length, items });
  });
}

export const OPTIONS = preflight;
