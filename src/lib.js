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
  if (o.tingkat_dosis) return o.tingkat_dosis.toLowerCase();
  const d = o.dosis_rekomendasi_ml ?? o.dosis_ml ?? 0;
  return d >= 80 ? 'kritis' : d >= 35 ? 'waspada' : d >= 10 ? 'preventif' : 'aman';
};

export const COLOR = { aman: 'var(--aman)', preventif: 'var(--prev)', waspada: 'var(--wasp)', kritis: 'var(--krit)' };
export const MSG = {
  aman: 'Kondisi aman, pompa tidak perlu menyala.',
  preventif: 'Risiko mulai naik, dosis preventif.',
  waspada: 'Gejala layu terdeteksi, dosis sedang.',
  kritis: 'Risiko Fusarium tinggi, dosis booster. Periksa tanaman langsung.',
};
export const dash = (v) => (v === undefined || v === null ? '–' : v);
