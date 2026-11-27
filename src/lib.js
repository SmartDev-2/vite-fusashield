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

/** Toleransi gangguan jaringan: tandai offline setelah 10 menit tanpa heartbeat. */
export function isLiveIotData(lastTelemetryAt, now = Date.now()) {
  const maxClockSkewMs = 5 * 1000;
  return Number.isFinite(lastTelemetryAt)
    && lastTelemetryAt <= now + maxClockSkewMs
    && now - lastTelemetryAt <= 10 * 60 * 1000;
}
