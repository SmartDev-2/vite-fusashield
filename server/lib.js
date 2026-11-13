// Fungsi bersama untuk endpoint mobile di Vercel (tanpa dependensi npm).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Nilai yang sama dengan milik website boleh memakai nama VITE_ (tidak perlu diisi dua kali di Vercel).
// Kunci rahasia (SUPABASE_KEY, MOBILE_SECRET, dst.) sengaja TIDAK punya cadangan VITE_.
const SHARED = ['FIREBASE_DATABASE_URL', 'DEVICE', 'SUPABASE_URL', 'SUPABASE_BUCKET', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_MODEL_FALLBACK'];

function readDotEnv() {
  try {
    const p = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const res = {};
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          let v = trimmed.slice(eq + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          res[k] = v;
        }
      }
      return res;
    }
  } catch {}
  return {};
}
const localEnv = readDotEnv();

const env = (k, d = '') =>
  process.env[k] ??
  localEnv[k] ??
  (SHARED.includes(k) ? (process.env['VITE_' + k] ?? localEnv['VITE_' + k]) : undefined) ??
  d;
export const DEVICE = () => env('DEVICE', 'cabai_01');

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
// CORS: perlu jika aplikasi Flutter dijalankan sebagai Web (browser). Aman karena akses tetap butuh token / kunci aplikasi.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-KEY',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
export const preflight = () => new Response(null, { status: 204, headers: CORS });
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });

export async function handle(fn) {
  try { return await fn(); }
  catch (e) {
    if (e instanceof HttpError) return json({ detail: e.message }, e.status);
    console.error(e);
    return json({ detail: 'Kesalahan server' }, 500);
  }
}

// ---------- Token bertanda tangan (HMAC-SHA256) ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function mac(body) {
  const secret = env('MOBILE_SECRET');
  if (!secret) throw new HttpError(500, 'MOBILE_SECRET belum diisi di Vercel');
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

export function makeToken(user) {
  const hours = parseFloat(env('TOKEN_HOURS', '12'));
  const body = Buffer.from(JSON.stringify({ sub: user, exp: Date.now() + hours * 3600_000 })).toString('base64url');
  return { token: `${body}.${mac(body)}`, expires_in: Math.round(hours * 3600) };
}

export function authUser(request) {
  const appKey = env('MOBILE_APP_KEY');
  // Jika MOBILE_APP_KEY tidak diisi di Vercel, izinkan akses langsung (mode publik)
  if (!appKey) return 'public';

  const given = request.headers.get('x-api-key');
  if (given && same(given, appKey)) return 'app';

  const h = request.headers.get('authorization') || '';
  if (h.startsWith('Bearer ')) {
    const [body, sig] = h.slice(7).split('.');
    if (body && sig && same(sig, mac(body))) {
      let p;
      try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch {}
      if (p && p.exp > Date.now()) return p.sub;
    }
  }
  throw new HttpError(401, 'Butuh login atau API Key tidak valid');
}

export function checkLogin(username, password) {
  let ok = false;
  for (const pair of env('MOBILE_USERS').split(',')) {
    const i = pair.indexOf(':');
    if (i < 1) continue;
    const u = pair.slice(0, i), p = pair.slice(i + 1);
    if (same(u, username) && same(p, password)) ok = true;
  }
  return ok;
}

// ---------- Pembatas laju (per instance; hanya pengaman tambahan) ----------
const hits = new Map();
export function limit(key, n, windowMs) {
  const now = Date.now();
  const q = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (q.length >= n) throw new HttpError(429, 'Terlalu banyak permintaan, coba lagi sebentar');
  q.push(now); hits.set(key, q);
}
export const clientIp = (request) =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'ip?';

// ---------- Firebase (REST; baca butuh Rules .read atau FIREBASE_AUTH) ----------
export async function fbGet(path, params = {}) {
  const q = new URLSearchParams(params);
  if (env('FIREBASE_AUTH')) q.set('auth', env('FIREBASE_AUTH'));
  const url = `${env('FIREBASE_DATABASE_URL').replace(/\/$/, '')}/${path}.json?${q}`;
  const r = await fetch(url);
  if (!r.ok) throw new HttpError(502, `Firebase menolak permintaan (${r.status}). Cek Rules dan FIREBASE_DATABASE_URL`);
  return r.json();
}

// ---------- Supabase ----------
const sbBase = () => env('SUPABASE_URL').replace(/\/$/, '');
export const sbHeaders = () => (env('SUPABASE_KEY') ? { apikey: env('SUPABASE_KEY'), Authorization: `Bearer ${env('SUPABASE_KEY')}` } : {});
export const BUCKET = () => env('SUPABASE_BUCKET');
const signed = new Map();

export async function photoUrl(path) {
  if (!path) return null;
  const enc = encodeURI(path);
  if (env('SUPABASE_PUBLIC', 'true') === 'true') return `${sbBase()}/storage/v1/object/public/${BUCKET()}/${enc}`;
  const hit = signed.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const r = await fetch(`${sbBase()}/storage/v1/object/sign/${BUCKET()}/${enc}`, {
    method: 'POST', headers: { ...sbHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!r.ok) return null;
  const url = `${sbBase()}/storage/v1${(await r.json()).signedURL}`;
  signed.set(path, { url, exp: Date.now() + 3_000_000 });
  return url;
}

export async function sbUpload(path, buf, mime) {
  const r = await fetch(`${sbBase()}/storage/v1/object/${BUCKET()}/${path}`, {
    method: 'POST', headers: { ...sbHeaders(), 'Content-Type': mime, 'x-upsert': 'false' }, body: buf,
  });
  if (!r.ok) throw new HttpError(502, `Penyimpanan menolak unggahan (${r.status})`);
}

export const DECISION_KEYS = ['tingkat_dosis', 'status_mitigasi', 'dosis_rekomendasi_ml', 'dosis_ml', 'cnn_label', 'cnn_confidence',
  'cnn_symptom_score', 'fase_hst', 'sisa_cooldown_detik', 'last_updated', 'alasan_blokir', 'foto_basi', 'foto_umur_jam',
  'foto_sumber', 'pump_command'];
export const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));

// ---------- Gemini LLM ----------
export async function callGemini(messages, { model, maxTokens = 1024, temperature = 0.7 } = {}) {
  const geminiKey = env('GEMINI_API_KEY');
  if (!geminiKey) throw new HttpError(503, 'GEMINI_API_KEY belum diisi di .env atau environment variables');
  const usedModel = model || env('GEMINI_MODEL', 'gemini-2.5-flash');

  // Pisahkan system instruction dan konten percakapan user/model
  const systemParts = [];
  const contents = [];

  for (const m of messages) {
    const role = m.role;
    const text = String(m.content || '').trim();
    if (!text) continue;

    if (role === 'system') {
      systemParts.push({ text });
    } else {
      const gRole = (role === 'assistant' || role === 'model') ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === gRole) {
        contents[contents.length - 1].parts[0].text += '\n\n' + text;
      } else {
        contents.push({ role: gRole, parts: [{ text }] });
      }
    }
  }

  // Gemini mengharuskan percakapan pertama berasal dari user
  while (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Halo' }] });
  }

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  };

  if (systemParts.length > 0) {
    payload.systemInstruction = { parts: systemParts };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(usedModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    // Fallback ke model cadangan jika model utama gagal/overloaded/tidak tersedia
    const fallbackModel = env('GEMINI_MODEL_FALLBACK', 'gemini-1.5-flash');
    if (fallbackModel && fallbackModel !== usedModel) {
      console.warn(`[Gemini] Gagal memanggil ${usedModel} (${r.status}), mencoba fallback ke ${fallbackModel}...`);
      return callGemini(messages, { model: fallbackModel, maxTokens, temperature });
    }
    throw new HttpError(502, `Gemini API error (${r.status}): ${errText.slice(0, 300)}`);
  }

  const data = await r.json();
  const candidate = data.candidates?.[0];
  const reply = candidate?.content?.parts?.[0]?.text;
  if (!reply && candidate?.finishReason === 'SAFETY') {
    return 'Maaf, respons tidak dapat ditampilkan karena filter keamanan.';
  }
  return reply ?? '';
}

// ---------- Groq LLM ----------
export async function callGroq(messages, { model, maxTokens = 1024, temperature = 0.7 } = {}) {
  const groqKey = env('GROQ_API_KEY');
  if (!groqKey) throw new HttpError(503, 'GROQ_API_KEY belum diisi di Vercel env vars');
  const usedModel = model || env('GROQ_MODEL', 'llama-3.3-70b-versatile');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: usedModel, messages, max_tokens: maxTokens, temperature }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    // Fallback ke model ringan jika model utama overloaded/quota
    if (r.status === 429 || r.status === 503) {
      const fallbackModel = env('GROQ_MODEL_FALLBACK', 'llama-3.1-8b-instant');
      if (fallbackModel !== usedModel) {
        return callGroq(messages, { model: fallbackModel, maxTokens, temperature });
      }
    }
    throw new HttpError(502, `Groq error (${r.status}): ${errText.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? '';
}
