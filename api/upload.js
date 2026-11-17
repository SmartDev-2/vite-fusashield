import crypto from 'node:crypto';
import { DEVICE, HttpError, clientIp, handle, json, limit, photoUrl, preflight, sbUpload } from '../server/lib.js';

const MAX = 4 * 1024 * 1024; // Vercel membatasi body fungsi 4,5 MB
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Tipe file ditentukan dari isi (magic bytes), bukan dari header atau nama yang dikirim klien.
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

// Catat foto baru ke Firebase supaya diambil layanan Keras (sama seperti endpoint mobile di FastAPI).
async function catatFoto(path) {
  const base = (process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
  if (!base) throw new HttpError(500, 'FIREBASE_DATABASE_URL belum diisi di Vercel');
  const auth = process.env.FIREBASE_AUTH ? `?auth=${encodeURIComponent(process.env.FIREBASE_AUTH)}` : '';
  const r = await fetch(`${base}/pending_photos/${DEVICE()}.json${auth}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, uploaded_by: 'web', uploaded_at: Math.floor(Date.now() / 1000), status: 'waiting' }),
  });
  if (!r.ok) throw new HttpError(502, `Firebase menolak catatan foto (${r.status}). Cek Rules pending_photos atau FIREBASE_AUTH`);
}

/** Body = bytes gambar mentah dari website. Simpan ke Supabase, lalu catat ke pending_photos untuk dinilai CNN. */
export async function POST(request) {
  return handle(async () => {
    limit(`upload:web:${clientIp(request)}`, 6, 60_000);
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) throw new HttpError(400, 'Tidak ada data foto');
    if (buf.length > MAX) throw new HttpError(413, 'Foto terlalu besar (maksimal 4 MB)');
    const ext = sniff(buf);
    if (!ext) throw new HttpError(400, 'File bukan gambar JPEG, PNG, atau WEBP');
    const path = `${DEVICE()}/${Date.now()}-web_${crypto.randomBytes(3).toString('hex')}.${ext}`;
    await sbUpload(path, buf, MIME[ext]);
    await catatFoto(path);
    return json({ path, photo_url: await photoUrl(path) });
  });
}

export const OPTIONS = preflight;