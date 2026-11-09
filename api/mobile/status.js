import { DECISION_KEYS, DEVICE, authUser, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

export async function GET(request) {
  return handle(async () => {
    authUser(request);
    const mon = (await fbGet(`monitoring/${DEVICE()}`)) || {};
    const f = mon.fuzzy_output || {};
    const soilOk = !!mon.soil_valid;
    return json({
      device: DEVICE(),
      sensors: {
        temperature: mon.temperature ?? null, humidity: mon.humidity ?? null, soil_valid: soilOk,
        soil_moisture: soilOk ? mon.soil_moisture : (f.input_kelembapan ?? null), pump_status: mon.pump_status ?? null,
      },
      decision: pick(f, DECISION_KEYS),
      photo_url: await photoUrl(f.foto_sumber),
    });
  });
}
