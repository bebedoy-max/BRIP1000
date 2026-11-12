"""Mesin wajah SuperIT untuk web (jalan di VPS).

Memakai engine yang sama dengan aplikasi companion (insightface buffalo_l,
embedding 512 dimensi) sehingga hasilnya kompatibel dengan data di Supabase.
Service ini TIDAK menyimpan apa pun: hanya mengubah foto menjadi embedding.
Pencocokan (match_worker_faces) dan penulisan database dilakukan web app memakai
sesi login admin, persis seperti companion.
"""

import os
import threading
import time
from typing import Dict, List, Optional

import requests
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from faces import FaceEngine, read_image

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
MAX_BYTES = int(os.environ.get("MAX_IMAGE_MB", "25")) * 1024 * 1024
ALLOWED_ROLES = {"it_admin", "superadmin", "event_admin"}

app = FastAPI(title="SuperIT Face Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS or ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
)

_engine: Optional[FaceEngine] = None
_engine_lock = threading.Lock()
_infer_lock = threading.Lock()  # satu foto per waktu; CPU-bound
_auth_cache: Dict[str, float] = {}


def engine() -> FaceEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = FaceEngine()
        return _engine


def authorize(authorization: Optional[str]) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Unauthorized")
    token = authorization[7:].strip()
    now = time.time()
    if _auth_cache.get(token, 0) > now:
        return
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
    try:
        u = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=15)
        if not u.ok:
            raise HTTPException(401, "Unauthorized")
        uid = u.json().get("id")
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/user_roles",
            params={"select": "role", "user_id": f"eq.{uid}"},
            headers=headers,
            timeout=15,
        )
        roles = {x["role"] for x in (r.json() if r.ok else [])}
    except requests.RequestException:
        raise HTTPException(503, "Supabase tidak terjangkau")
    if not roles & ALLOWED_ROLES:
        raise HTTPException(403, "Forbidden")
    if len(_auth_cache) > 500:
        _auth_cache.clear()
    _auth_cache[token] = now + 300


async def _read(file: UploadFile):
    data = await file.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "Ukuran foto tidak valid")
    img = read_image(data)
    if img is None:
        raise HTTPException(422, "File foto tidak terbaca")
    return img


@app.get("/health")
def health():
    return {"ok": True, "engine": "insightface/buffalo_l", "loaded": _engine is not None}


@app.post("/warmup")
def warmup(authorization: Optional[str] = Header(None)):
    authorize(authorization)
    engine()
    return {"ok": True}


@app.post("/embed")
async def embed(file: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    """Foto event: semua wajah -> daftar embedding."""
    authorize(authorization)
    img = await _read(file)
    with _infer_lock:
        embs: List[List[float]] = engine().embeddings(img)
    return {"faces": len(embs), "embeddings": embs}


@app.post("/master")
async def master(file: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    """Foto master pekerja: satu wajah utama + kualitas (0..1)."""
    authorize(authorization)
    img = await _read(file)
    with _infer_lock:
        res = engine().single_face(img)
    if res is None:
        return {"found": False}
    emb, quality = res
    return {"found": True, "embedding": emb, "quality": quality}
