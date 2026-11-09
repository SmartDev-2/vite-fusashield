import { DECISION_KEYS, DEVICE, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

export async function GET(request) {
  return handle(async () => {
    // Tanpa authUser(request) agar APK mobile publik bisa langsung membaca riwayat
    const url = new URL(request.url);
    const n = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10) || 30));
    
    let raw = {};
    try {
      raw = (await fbGet(`history_log/${DEVICE()}`, { orderBy: '"$key"', limitToLast: String(n) })) || {};
    } catch (e) {
      console.warn('History read warning:', e);
      return json({ items: [] });
    }

    const items = await Promise.all(
      Object.keys(raw)
        .sort()
        .reverse()
        .map(async (id) => {
          const v = raw[id] || {};
          return {
            id,
            ...pick(v, DECISION_KEYS),
            temperature: v.input_suhu ?? null,
            humidity: v.input_kelembapan_udara ?? null,
            soil_moisture: v.input_kelembapan ?? null,
            photo_url: await photoUrl(v.foto_sumber),
          };
        })
    );
    
    return json({ items });
  });
}

import { preflight as _preflight } from '../../server/lib.js';
export const OPTIONS = _preflight;