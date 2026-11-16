import { DECISION_KEYS, DEVICE, authUser, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

export async function GET(request) {
  return handle(async () => {
    const mon = (await fbGet(`monitoring/${DEVICE()}`)) || {};
    const f = mon.fuzzy_output || {};
    const soilOk = mon.soil_valid != null ? Boolean(mon.soil_valid) : null;
    return json({
      device: DEVICE(),
      sensors: {
        temperature: mon.temperature ?? null,
        humidity: mon.humidity ?? null,
        soil_valid: soilOk,
        soil_moisture: soilOk ? mon.soil_moisture : (f.input_kelembapan ?? mon.soil_moisture ?? null),
        pump_status: mon.pump_status ?? null,
      },
      decision: pick(f, DECISION_KEYS),
      photo_url: await photoUrl(f.foto_sumber),
    });
  });
}

import { preflight as _preflight } from '../../server/lib.js';
export const OPTIONS = _preflight;
