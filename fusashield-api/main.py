"""FusaShield API — jembatan mobile ↔ Firebase/Supabase.

Alur data:
  IoT + Citra  →  Firebase RTDB & Supabase Storage
               →  Keras (proses terpisah, di luar API ini)
               →  Firebase RTDB
               →  Website (langsung baca Firebase)
               →  Mobile (via API ini)

API ini TIDAK memuat model.  Tugasnya:
  1. Menerima foto dari mobile → simpan ke Supabase
  2. Menyajikan data monitoring/history dari Firebase ke mobile
  3. Autentikasi mobile (HMAC token)
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import date
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials, db

_base_dir = Path(__file__).resolve().parent
load_dotenv(_base_dir / ".env")
load_dotenv(_base_dir.parent / ".env")
load_dotenv()

E = os.getenv
DEVICE = E("DEVICE", "cabai_01")
SB_URL = E("SUPABASE_URL", "").rstrip("/")
SB_BUCKET = E("SUPABASE_BUCKET", "")
SB_KEY = E("SUPABASE_KEY", "")
SB_PUBLIC = E("SUPABASE_PUBLIC", "true").lower() == "true"
TZ = ZoneInfo(E("TZ_NAME", "Asia/Jakarta"))


# ---------------- Supabase helpers ----------------
def sb_headers():
    return {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"} if SB_KEY else {}


def photo_public_url(path: str) -> str:
    """URL publik foto di Supabase Storage."""
    return f"{SB_URL}/storage/v1/object/public/{SB_BUCKET}/{quote(path)}"


def photo_signed_url(path: str, expires: int = 3600) -> str | None:
    """URL signed (untuk bucket private)."""
    r = requests.post(
        f"{SB_URL}/storage/v1/object/sign/{SB_BUCKET}/{quote(path)}",
        headers=sb_headers(), json={"expiresIn": expires}, timeout=10,
    )
    if not r.ok:
        return None
    return f"{SB_URL}/storage/v1{r.json()['signedURL']}"


# ---------------- HST ----------------
def hst() -> int:
    if E("HST_OVERRIDE"):
        return int(E("HST_OVERRIDE"))
    return (date.today() - date.fromisoformat(E("PLANT_DATE", date.today().isoformat()))).days


# ---------------- App ----------------
FIREBASE_OK = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global FIREBASE_OK
    try:
        firebase_admin.initialize_app(
            credentials.Certificate(E("FIREBASE_CRED", "serviceAccountKey.json")),
            {"databaseURL": E("FIREBASE_DATABASE_URL")},
        )
        FIREBASE_OK = True
        print("[✓] Firebase terhubung")
    except Exception as exc:
        print(f"[!] Firebase GAGAL init: {exc}")
        print("[!] API tetap jalan — endpoint yang butuh Firebase akan return 503")
    yield


app = FastAPI(title="FusaShield API", lifespan=lifespan)

# CORS — izinkan website frontend mengakses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=E("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_firebase():
    if not FIREBASE_OK:
        raise HTTPException(503, "Firebase belum terhubung — periksa serviceAccountKey.json")


def fb_get(path: str):
    """Ambil data dari Firebase Realtime Database (Admin SDK dengan fallback REST API)."""
    if FIREBASE_OK:
        try:
            return db.reference(path).get()
        except Exception as e:
            print(f"[!] Gagal baca Firebase Admin: {e}")
    db_url = E("FIREBASE_DATABASE_URL")
    if db_url:
        try:
            clean_url = db_url.rstrip("/")
            r = requests.get(f"{clean_url}/{path.lstrip('/')}.json", timeout=10)
            if r.ok:
                return r.json()
        except Exception as e:
            print(f"[!] Gagal baca Firebase REST API: {e}")
    return None


def fb_post(path: str, data: dict):
    """Kirim data ke Firebase Realtime Database (Admin SDK dengan fallback REST API)."""
    if FIREBASE_OK:
        try:
            ref = db.reference(path)
            new_ref = ref.push(data)
            return new_ref.key
        except Exception as e:
            print(f"[!] Gagal tulis Firebase Admin: {e}")
    db_url = E("FIREBASE_DATABASE_URL")
    if db_url:
        try:
            clean_url = db_url.rstrip("/")
            r = requests.post(f"{clean_url}/{path.lstrip('/')}.json", json=data, timeout=10)
            if r.ok:
                return r.json().get("name")
        except Exception as e:
            print(f"[!] Gagal tulis Firebase REST API: {e}")
    return None


def auth(x_api_key: str | None = Header(None)):
    if E("API_KEY") and x_api_key != E("API_KEY"):
        raise HTTPException(401, "X-API-KEY salah")
    require_firebase()


# ---------------- Endpoint dasar ----------------
@app.get("/health")
def health():
    return {"ok": True, "firebase": FIREBASE_OK, "device": DEVICE, "hst": hst()}


@app.get("/monitoring/{device}", dependencies=[Depends(auth)])
def get_monitoring(device: str):
    """Ambil data monitoring realtime dari Firebase untuk device tertentu."""
    data = db.reference(f"monitoring/{device}").get()
    if data is None:
        raise HTTPException(404, f"Device '{device}' tidak ditemukan")
    # Tambahkan photo_url jika ada fuzzy_output.foto_sumber
    fuzzy = data.get("fuzzy_output") or {}
    foto = fuzzy.get("foto_sumber")
    if foto:
        fuzzy["photo_url"] = photo_public_url(foto) if SB_PUBLIC else photo_signed_url(foto)
    return data


@app.get("/history/{device}", dependencies=[Depends(auth)])
def get_history(device: str, limit: int = 50):
    """Ambil history_log dari Firebase, N catatan terakhir."""
    limit = min(max(1, limit), 200)
    raw = db.reference(f"history_log/{device}").order_by_key().limit_to_last(limit).get() or {}
    rows = []
    for k, v in sorted(raw.items(), reverse=True):
        foto = v.get("foto_sumber")
        rows.append({
            "id": k,
            **v,
            "photo_url": (photo_public_url(foto) if SB_PUBLIC else photo_signed_url(foto)) if foto else None,
        })
    return {"device": device, "count": len(rows), "items": rows}


# --- Endpoint aplikasi Flutter ---
import mobile  # noqa: E402
app.include_router(mobile.router)
