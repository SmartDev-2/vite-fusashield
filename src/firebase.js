import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, limitToLast, remove } from 'firebase/database';

const E = import.meta.env;
const app = initializeApp({
  apiKey: E.VITE_FIREBASE_API_KEY,
  databaseURL: E.VITE_FIREBASE_DATABASE_URL,
  projectId: E.VITE_FIREBASE_PROJECT_ID,
});
const db = getDatabase(app);

/** Listener realtime. Kembalikan [data, error, waktu telemetry terakhir]. */
export function useDb(path, last, trackTelemetry = false) {
  const [state, setState] = useState([null, null, null]);
  useEffect(() => {
    let previousTelemetry = null;
    let initialized = false;
    setState([null, null, null]);
    const r = ref(db, path);
    return onValue(
      last ? query(r, limitToLast(last)) : r,
      (s) => {
        const data = s.val();
        const telemetry = trackTelemetry && data && typeof data === 'object'
          ? JSON.stringify({
            uptime_ms: data.uptime_ms,
            temperature: data.temperature,
            humidity: data.humidity,
            soil_valid: data.soil_valid,
            soil_moisture: data.soil_moisture,
            soil_raw: data.soil_raw,
          })
          : null;
        const changed = initialized && telemetry !== null && telemetry !== previousTelemetry;
        initialized = true;
        previousTelemetry = telemetry;
        setState((current) => [data, null, changed ? Date.now() : current[2]]);
      },
      (e) => setState([null, e.message, null]),
    );
  }, [path, last, trackTelemetry]);
  return state;
}

export function useConnected() {
  const [on, setOn] = useState(false);
  useEffect(() => onValue(ref(db, '.info/connected'), (s) => setOn(!!s.val())), []);
  return on;
}

/** Hapus node monitoring/{device} di Firebase (misal untuk membersihkan data demo lama) */
export async function clearMonitoring(device) {
  try {
    await remove(ref(db, `monitoring/${device}`));
    return { ok: true };
  } catch (e) {
    console.error('Gagal hapus monitoring Firebase:', e);
    return { ok: false, error: e.message };
  }
}
