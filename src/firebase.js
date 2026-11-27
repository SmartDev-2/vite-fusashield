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

const predictionsApp = initializeApp({
  databaseURL: import.meta.env.VITE_PREDICTIONS_FIREBASE_DATABASE_URL
    || 'https://projectpcv-8bb52-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'projectpcv-8bb52',
}, 'classification-results');
const predictionsDb = getDatabase(predictionsApp);

let lastKnownUptime = null;
let lastKnownTelemetryAt = null;

try {
  const cachedTime = Number(localStorage.getItem('fs_last_telemetry'));
  if (Number.isFinite(cachedTime)) lastKnownTelemetryAt = cachedTime;
  const cachedUpt = Number(localStorage.getItem('fs_last_uptime'));
  if (Number.isFinite(cachedUpt)) lastKnownUptime = cachedUpt;
} catch {}

/** Listener realtime. Kembalikan [data, error, waktu update terakhir]. */
export function useDb(path, last, trackTelemetry = false) {
  const [state, setState] = useState([null, null, null]);
  useEffect(() => {
    setState([null, null, null]);
    const r = ref(db, path);
    return onValue(
      last ? query(r, limitToLast(last)) : r,
      (s) => {
        const data = s.val();
        let telemetryAt = null;

        if (trackTelemetry && data && typeof data === 'object') {
          const now = Date.now();
          const currentUptime = typeof data.uptime_ms === 'number' ? data.uptime_ms : null;
          const hasSensors = data.temperature != null || data.humidity != null;

          // Cek apakah ada epoch waktu nyata di root data
          const explicitEpoch = data.last_telemetry_epoch || data.last_active_epoch || data.epoch || data.timestamp;
          if (typeof explicitEpoch === 'number' && explicitEpoch > 0) {
            telemetryAt = explicitEpoch > 1e11 ? explicitEpoch : explicitEpoch * 1000;
          } else if (currentUptime != null || hasSensors) {
            // Stopwatch berbasis kedatangan data telemetri:
            // 1. Jika uptime_ms berubah dari data sebelumnya -> ESP32 aktif mengirim data baru!
            if (currentUptime != null && lastKnownUptime != null && currentUptime !== lastKnownUptime) {
              telemetryAt = now;
              lastKnownTelemetryAt = now;
              lastKnownUptime = currentUptime;
              try {
                localStorage.setItem('fs_last_telemetry', String(now));
                localStorage.setItem('fs_last_uptime', String(currentUptime));
              } catch {}
            }
            // 2. Jika pertama kali menerima data:
            else if (lastKnownUptime == null) {
              lastKnownUptime = currentUptime;
              if (lastKnownTelemetryAt && (now - lastKnownTelemetryAt) <= 10 * 60 * 1000) {
                telemetryAt = lastKnownTelemetryAt;
              } else {
                telemetryAt = now;
                lastKnownTelemetryAt = now;
                try {
                  localStorage.setItem('fs_last_telemetry', String(now));
                  if (currentUptime != null) localStorage.setItem('fs_last_uptime', String(currentUptime));
                } catch {}
              }
            }
            // 3. Jika onValue terpanggil lagi (ada update dari Firebase)
            else {
              telemetryAt = now;
              lastKnownTelemetryAt = now;
              try {
                localStorage.setItem('fs_last_telemetry', String(now));
              } catch {}
            }
          }
        }

        setState((current) => [data, null, telemetryAt ?? current[2]]);
      },
      (e) => setState((current) => [current[0], e.message, current[2]]),
    );
  }, [path, last, trackTelemetry]);
  return state;
}

/** Listener realtime untuk hasil klasifikasi pada project Firebase terpisah. */
export function usePredictions() {
  const [state, setState] = useState({
    latest: null,
    history: null,
    latestError: null,
    historyError: null,
  });

  useEffect(() => {
    const stopLatest = onValue(
      ref(predictionsDb, 'predictions/latest'),
      (snapshot) => setState((current) => ({ ...current, latest: snapshot.val(), latestError: null })),
      (error) => setState((current) => ({ ...current, latestError: error.message })),
    );
    const stopHistory = onValue(
      ref(predictionsDb, 'predictions/history'),
      (snapshot) => setState((current) => ({ ...current, history: snapshot.val(), historyError: null })),
      (error) => setState((current) => ({ ...current, historyError: error.message })),
    );

    return () => {
      stopLatest();
      stopHistory();
    };
  }, []);

  return {
    latest: state.latest,
    history: state.history,
    error: state.latestError || state.historyError,
  };
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
