import { checkLogin, clientIp, handle, json, HttpError, limit, makeToken } from '../../server/lib.js';

export async function POST(request) {
  return handle(async () => {
    limit(`login:${clientIp(request)}`, 5, 60_000);
    let b = {};
    try { b = await request.json(); } catch { /* body kosong */ }
    if (!checkLogin(String(b.username ?? ''), String(b.password ?? ''))) throw new HttpError(401, 'Username atau password salah');
    return json(makeToken(String(b.username)));
  });
}
