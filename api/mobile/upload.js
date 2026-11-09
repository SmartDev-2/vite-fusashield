import crypto from 'node:crypto';
import { DEVICE, HttpError, authUser, handle, json, limit, photoUrl, sbUpload } from '../../server/lib.js';

const MAX = 4 * 1024 * 1024; // Vercel membatasi body fungsi 4,5 MB
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Tipe file ditentukan dari isi (magic bytes), bukan dari header atau nama yang dikirim klien.
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

/** Body = bytes gambar mentah. Disimpan ke Supabase; CNN diproses terpisah oleh layanan Keras. */
export async function POST(request) {
  return handle(async () => {
    const user = authUser(request);
    limit(`upload:${user}`, 6, 60_000);
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) throw new HttpError(400, 'Tidak ada data foto');
    if (buf.length > MAX) throw new HttpError(413, 'Foto terlalu besar (maksimal 4 MB)');
    const ext = sniff(buf);
    if (!ext) throw new HttpError(400, 'File bukan gambar JPEG, PNG, atau WEBP');
    const path = `${DEVICE()}/${Date.now()}-mobile_${crypto.randomBytes(3).toString('hex')}.${ext}`; // nama dibuat server
    await sbUpload(path, buf, MIME[ext]);
    return json({ path, photo_url: await photoUrl(path) });
  });
}

import { preflight as _preflight } from '../../server/lib.js';
export const OPTIONS = _preflight;
