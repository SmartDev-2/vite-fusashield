import { clientIp, handle, json, limit, predictionsFbGet, preflight } from '../../server/lib.js';

export async function GET(request) {
  return handle(async () => {
    limit(`predictions:latest:${clientIp(request)}`, 60, 60_000);
    const latest = await predictionsFbGet('predictions/latest');
    return json({ latest });
  });
}

export const OPTIONS = preflight;
