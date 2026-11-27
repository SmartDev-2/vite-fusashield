import { DECISION_KEYS, DEVICE, authUser, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

/** Cek apakah data IoT masih fresh (dalam 10 menit terakhir). */
function isIotActive(f, mon = {}) {
  // Jika ditandai eksplisit sebagai DEMO
  const isDemo = f.sumber_sensor?.temperature === 'DEMO' || f.mode_keputusan?.includes('DEMO');
  if (isDemo) return false;

  // Coba epoch waktu nyata dulu jika ada
  const epoch = mon.last_active_epoch || mon.last_telemetry_epoch || f.last_active_epoch;
  if (typeof epoch === 'number' && epoch > 0) {
    const s = epoch > 1e11 ? epoch / 1000 : epoch;
    return (Date.now() / 1000 - s) <= 600; // 10 menit
  }

  // Jika ada timestamp update string yang masih baru (< 10 menit)
  const str = f.last_updated;
  if (str) {
    const ms = new Date(str.replace(' ', 'T') + '+07:00').getTime();
    if (Number.isFinite(ms) && (Date.now() - ms) <= 10 * 60 * 1000) {
      return true;
    }
  }

  // Jika ada data sensor riil dari ESP32 (ada uptime dan nilai sensor)
  if (mon.uptime_ms != null && (mon.temperature != null || mon.humidity != null)) {
    return true;
  }

  return false;
}

export async function GET(request) {
  return handle(async () => {
    const mon = (await fbGet(`monitoring/${DEVICE()}`)) || {};
    const f = mon.fuzzy_output || {};
    const soilOk = mon.soil_valid != null ? Boolean(mon.soil_valid) : null;
    const iotActive = isIotActive(f, mon);
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
