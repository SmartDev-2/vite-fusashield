const E = import.meta.env;
export const CFG = {
  device: E.VITE_DEVICE || 'cabai_01',
  sbUrl: (E.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  bucket: E.VITE_SUPABASE_BUCKET || '',
};

/** Bucket Supabase harus Public. */
export const photoUrl = (p) =>
  p ? `${CFG.sbUrl}/storage/v1/object/public/${CFG.bucket}/${encodeURI(p)}` : null;

export const level = (o = {}) => {
  if (!o || Object.keys(o).length === 0) return null;
  if (o.tingkat_dosis) return o.tingkat_dosis.toLowerCase();
  if (o.dosis_rekomendasi_ml != null || o.dosis_ml != null) {
    const d = o.dosis_rekomendasi_ml ?? o.dosis_ml;
    return d >= 80 ? 'kritis' : d >= 35 ? 'waspada' : d >= 10 ? 'preventif' : 'aman';
  }
  return null;
};

export const COLOR = { aman: 'var(--aman)', preventif: 'var(--prev)', waspada: 'var(--wasp)', kritis: 'var(--krit)' };
export const MSG = {
  aman: 'Kondisi aman, pompa tidak perlu menyala.',
  preventif: 'Risiko mulai naik, dosis preventif.',
  waspada: 'Gejala layu terdeteksi, dosis sedang.',
  kritis: 'Risiko Fusarium tinggi, dosis booster. Periksa tanaman langsung.',
};
export const dash = (v) => (v === undefined || v === null ? '–' : v);

/** Cek apakah data sensor di Firebase benar-benar dari IoT hidup, bukan demo atau data basi */
export function isLiveIotData(mon) {
  if (!mon || typeof mon !== 'object') return false;

  const f = mon.fuzzy_output || {};
  const S = f.sumber_sensor || {};

  // 1. Cek apakah ada penanda DEMO eksplisit
  const isDemo = Boolean(
    S.temperature === 'DEMO' ||
    S.humidity === 'DEMO' ||
    S.soil_moisture === 'DEMO' ||
    (typeof f.mode_keputusan === 'string' && f.mode_keputusan.toUpperCase().includes('DEMO'))
  );
  if (isDemo) return false;

  // 2. Cek apakah status_iot eksplisit TIDAK_AKTIF atau OFFLINE
  if (f.status_iot && f.status_iot !== 'AKTIF') return false;

  // 3. Cek apakah data sudah kedaluwarsa (stale / lebih dari 15 menit yang lalu)
  if (f.last_updated) {
    try {
      const t = new Date(f.last_updated.replace(' ', 'T')).getTime();
      if (!isNaN(t)) {
        const ageMinutes = (Date.now() - t) / 60000;
        if (ageMinutes > 15) return false;
      }
    } catch {}
  }

  // 4. Pastikan setidaknya ada data sensor terbaca
  const hasSensors = mon.temperature != null || mon.humidity != null || (mon.soil_valid && mon.soil_moisture != null);
  return Boolean(hasSensors);
}
