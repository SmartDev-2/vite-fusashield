import { json, preflight } from '../server/lib.js';

export const GET = () => json({ ok: true });
export const OPTIONS = preflight;
