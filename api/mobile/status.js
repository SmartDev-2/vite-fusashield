import { DECISION_KEYS, DEVICE, authUser, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

/** Cek apakah data IoT masih fresh (dalam 10 menit terakhir). */
function isIotActive(f) {
  // Coba last_active_epoch (UNIX detik) dulu
  const epoch = f.last_active_epoch;
  if (typeof epoch === 'number' && epoch > 0) {
    return (Date.now() / 1000 - epoch) <= 600; // 10 menit
  }
  // Fallback: parse last_updated string "YYYY-MM-DD HH:mm:ss" (WIB = UTC+7)
  const str = f.last_updated;
  if (!str) return false;
  const ms = new Date(str.replace(' ', 'T') + '+07:00').getTime();
  if (!Number.isFinite(ms)) return false;
  return (Date.now() - ms) <= 10 * 60 * 1000;
}

export async function GET(request) {
  return handle(async () => {
    const mon = (await fbGet(`monitoring/${DEVICE()}`)) || {};
    const f = mon.fuzzy_output || {};
    const soilOk = mon.soil_valid != null ? Boolean(mon.soil_valid) : null;
    const iotActive = isIotActive(f);
    return json({
      device: DEVICE(),
      iot_active: iotActive,
      sensors: iotActive ? {
        temperature: mon.temperature ?? null,
        humidity: mon.humidity ?? null,
        soil_valid: soilOk,
        soil_moisture: soilOk ? mon.soil_moisture : (f.input_kelembapan ?? mon.soil_moisture ?? null),
        pump_status: mon.pump_status ?? null,
      } : {
        temperature: null,
        humidity: null,
        soil_valid: null,
        soil_moisture: null,
        pump_status: null,
      },
      decision: pick(f, DECISION_KEYS),
      photo_url: await photoUrl(f.foto_sumber),
    });
  });
}

import { preflight as _preflight } from '../../server/lib.js';
export const OPTIONS = _preflight;
