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

/** Listener realtime. Kembalikan [data, error]. `last` = ambil N data terakhir. */
export function useDb(path, last) {
  const [state, setState] = useState([null, null]);
  useEffect(() => {
    const r = ref(db, path);
    return onValue(
      last ? query(r, limitToLast(last)) : r,
      (s) => setState([s.val(), null]),
      (e) => setState([null, e.message]),
    );
  }, [path, last]);
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
