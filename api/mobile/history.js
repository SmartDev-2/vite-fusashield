import { DECISION_KEYS, DEVICE, authUser, fbGet, handle, json, photoUrl, pick } from '../../server/lib.js';

export async function POST(request) {
  return handle(async () => {
    limit('upload:mobile', 20, 60_000);
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) throw new HttpError(400, 'Tidak ada data foto');
    if (buf.length > MAX) throw new HttpError(413, 'Foto terlalu besar (maksimal 4 MB)');
    const ext = sniff(buf);
    if (!ext) throw new HttpError(400, 'File bukan gambar JPEG, PNG, atau WEBP');
    const path = `${DEVICE()}/${Date.now()}-mobile_${crypto.randomBytes(3).toString('hex')}.${ext}`;
    await sbUpload(path, buf, MIME[ext]);
    return json({ path, photo_url: await photoUrl(path) });
  });
}

import { preflight as _preflight } from '../../server/lib.js';
export const OPTIONS = _preflight;
