"""Endpoint khusus aplikasi Flutter.

Aplikasi HANYA bicara ke API ini.
Kunci Supabase (service_role) dan kredensial sensitif tidak pernah ada di aplikasi mobile.
"""

import base64, hashlib, hmac, io, json, os, secrets, time
from collections import defaultdict, deque
from urllib.parse import quote

import requests
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

import main as core  # referensi runtime ke main.py

router = APIRouter(prefix="/mobile", tags=["mobile"])
Image.MAX_IMAGE_PIXELS = 20_000_000
MAX_BYTES = 5 * 1024 * 1024


# ---------- Token bertanda tangan (HMAC-SHA256, tanpa library tambahan) ----------
def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _mac(body: str) -> str:
    secret = os.getenv("MOBILE_SECRET")
    if not secret:
        raise HTTPException(500, "MOBILE_SECRET belum diisi di .env")
    return _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())


def make_token(user: str) -> str:
    hours = float(os.getenv("TOKEN_HOURS", "12"))
    body = _b64(json.dumps({"sub": user, "exp": time.time() + hours * 3600}).encode())
    return f"{body}.{_mac(body)}"


def read_token(token: str) -> dict:
    try:
        body, sig = token.split(".")
    except ValueError:
        raise HTTPException(401, "Token tidak valid")
    if not hmac.compare_digest(sig, _mac(body)):
        raise HTTPException(401, "Token tidak valid")
    payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    if payload["exp"] < time.time():
        raise HTTPException(401, "Sesi habis, silakan login ulang")
    return payload


def current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Butuh login")
    return read_token(authorization[7:])["sub"]


# ---------- Pembatas laju (in-memory) ----------
_hits: dict[str, deque] = defaultdict(deque)


def limit(key: str, n: int, window: int):
    now, q = time.time(), _hits[key]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= n:
        raise HTTPException(429, "Terlalu banyak permintaan, coba lagi sebentar")
    q.append(now)


# ---------- URL foto (public atau signed) ----------
_signed: dict[str, tuple[str, float]] = {}


def photo_url(path: str | None) -> str | None:
    if not path:
        return None
    if core.SB_PUBLIC:
        return f"{core.SB_URL}/storage/v1/object/public/{core.SB_BUCKET}/{quote(path)}"
    hit = _signed.get(path)
    if hit and hit[1] > time.time():
        return hit[0]
    r = requests.post(
        f"{core.SB_URL}/storage/v1/object/sign/{core.SB_BUCKET}/{quote(path)}",
        headers=core.sb_headers(), json={"expiresIn": 3600}, timeout=10,
    )
    if not r.ok:
        return None
    url = f"{core.SB_URL}/storage/v1{r.json()['signedURL']}"
    _signed[path] = (url, time.time() + 3000)
    return url


# ---------- Endpoint ----------
class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginIn, request: Request):
    """Login petani, return HMAC token."""
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "?")
    limit(f"login:{ip}", 5, 60)
    ok = False
    for pair in os.getenv("MOBILE_USERS", "").split(","):
        u, _, p = pair.partition(":")
        if u and hmac.compare_digest(u.encode(), body.username.encode()) and hmac.compare_digest(p.encode(), body.password.encode()):
            ok = True
    if not ok:
        raise HTTPException(401, "Username atau password salah")
    return {"token": make_token(body.username), "expires_in": int(float(os.getenv("TOKEN_HOURS", "12")) * 3600)}


# ---------- Keys yang dikirim ke mobile ----------
DECISION_KEYS = [
    "tingkat_dosis", "status_mitigasi", "dosis_rekomendasi_ml", "dosis_ml",
    "cnn_label", "cnn_confidence", "cnn_symptom_score", "fase_hst",
    "sisa_cooldown_detik", "last_updated", "alasan_blokir", "foto_basi", "foto_umur_jam",
]


@router.get("/status")
def status(user: str = Depends(current_user)):
    """Status realtime: sensor + keputusan fuzzy terbaru dari Firebase."""
    mon = core.fb_get(f"monitoring/{core.DEVICE}") or {}
    f = mon.get("fuzzy_output") or {}
    soil_ok = bool(mon.get("soil_valid"))
    return {
        "device": core.DEVICE,
        "sensors": {
            "temperature": mon.get("temperature"),
            "humidity": mon.get("humidity"),
            "soil_valid": soil_ok,
            "soil_moisture": mon.get("soil_moisture") if soil_ok else f.get("input_kelembapan"),
            "pump_status": mon.get("pump_status"),
        },
        "decision": {k: f.get(k) for k in DECISION_KEYS},
        "photo_url": photo_url(f.get("foto_sumber")),
    }


@router.get("/history")
def history(limit_: int = Query(30, alias="limit", ge=1, le=100), user: str = Depends(current_user)):
    """Riwayat keputusan fuzzy dari Firebase."""
    raw = core.fb_get(f"history_log/{core.DEVICE}") or {}
    rows = []
    for k, v in sorted(raw.items(), reverse=True)[:limit_]:
        rows.append({
            "id": k,
            **{x: v.get(x) for x in DECISION_KEYS},
            "temperature": v.get("input_suhu"),
            "humidity": v.get("input_kelembapan_udara"),
            "soil_moisture": v.get("input_kelembapan"),
            "photo_url": photo_url(v.get("foto_sumber")),
        })
    return {"items": rows}


@router.post("/upload")
def upload(file: UploadFile = File(...), user: str = Depends(current_user)):
    """Foto dari Flutter → divalidasi server → disimpan ke Supabase pakai kunci server."""
    limit(f"upload:{user}", 6, 60)
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Foto terlalu besar (maksimal 5 MB)")
    try:
        Image.open(io.BytesIO(data)).verify()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "File bukan gambar yang valid")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)

    path = f"{core.DEVICE}/{int(time.time() * 1000)}-mobile_{secrets.token_hex(3)}.jpg"
    r = requests.post(
        f"{core.SB_URL}/storage/v1/object/{core.SB_BUCKET}/{path}",
        data=buf.getvalue(), timeout=30,
        headers={**core.sb_headers(), "Content-Type": "image/jpeg", "x-upsert": "false"},
    )
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"Penyimpanan menolak unggahan ({r.status_code})")

    # Catat di Firebase via REST API
    core.fb_post(f"pending_photos/{core.DEVICE}", {
        "path": path,
        "uploaded_by": user,
        "uploaded_at": int(time.time()),
        "status": "waiting",
    })

    return {
        "path": path,
        "photo_url": photo_url(path),
        "message": "Foto berhasil diunggah. Menunggu proses Keras.",
    }
