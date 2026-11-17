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
        const receivedAt = trackTelemetry && data && typeof data === 'object' ? Date.now() : null;
        setState((current) => [data, null, receivedAt ?? current[2]]);
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
