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

/** Listener realtime. Kembalikan [data, error, waktu update terakhir]. */
export function useDb(path, last, trackTelemetry = false) {
  const [state, setState] = useState([null, null, null]);
  useEffect(() => {
    let previousData = null;
    let initialized = false;
    setState([null, null, null]);
    const r = ref(db, path);
    return onValue(
      last ? query(r, limitToLast(last)) : r,
      (s) => {
        const data = s.val();
        const fingerprint = trackTelemetry && data && typeof data === 'object'
          ? JSON.stringify(data)
          : null;
        const changed = fingerprint !== null && (!initialized || fingerprint !== previousData);
        initialized = true;
        previousData = fingerprint;
        setState((current) => [data, null, changed ? Date.now() : current[2]]);
      },
      (e) => setState((current) => [current[0], e.message, current[2]]),
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
