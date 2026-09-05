"""Unggah ke Google Drive lewat web app SuperIT.

Alur utama memakai *resumable upload*: web app hanya membuatkan sesi upload,
lalu byte foto dikirim LANGSUNG ke server Google. Dengan begitu ukuran foto
tidak dibatasi oleh limit payload serverless (error 413 / PAYLOAD_TOO_LARGE).
Jika endpoint resumable belum tersedia (web app versi lama), otomatis kembali
ke cara lama (base64 lewat web app) untuk file kecil.
"""

import base64
import mimetypes
import os
import time
from typing import Callable, Dict

import requests

# Batas aman payload base64 lewat web app (mode fallback).
FALLBACK_MAX_BYTES = 3 * 1024 * 1024


class Drive:
    """Jembatan ke endpoint companion di web app."""

    def __init__(self, panel_url: str, token_provider: Callable[[], str]):
        self.base = panel_url.rstrip("/")
        self._token = token_provider
        self._resumable_ok = True

    # ---------- status ----------
    def status(self) -> Dict[str, object]:
        res = requests.get(f"{self.base}/api/public/companion/drive-status", timeout=30)
        res.raise_for_status()
        return res.json()

    # ---------- kompatibilitas ----------
    def event_folder(self, event_name: str) -> str:
        """Nama subfolder event; folder sebenarnya dibuat oleh web app."""
        return event_name

    def _headers(self, force_refresh: bool = False) -> Dict[str, str]:
        try:
            token = self._token(force_refresh)  # type: ignore[call-arg]
        except TypeError:
            token = self._token()
        return {"Authorization": f"Bearer {token}"}

    # ---------- upload ----------
    def upload(self, folder_name: str, local_path: str, file_name: str) -> dict:
        mime = mimetypes.guess_type(local_path)[0] or "image/jpeg"
        if self._resumable_ok:
            try:
                return self._upload_resumable(folder_name, local_path, file_name, mime)
            except _NoResumable:
                self._resumable_ok = False
        return self._upload_base64(folder_name, local_path, file_name, mime)

    def _upload_resumable(self, folder_name: str, local_path: str, file_name: str, mime: str) -> dict:
        size = os.path.getsize(local_path)
        last = ""
        for attempt in range(4):
            init = requests.post(
                f"{self.base}/api/public/companion/upload-url",
                json={"subfolder": folder_name, "fileName": file_name, "mimeType": mime},
                headers=self._headers(force_refresh=attempt > 0),
                timeout=120,
            )
            if init.status_code == 404:
                raise _NoResumable()
            if not init.ok:
                last = f"[{init.status_code}] {init.text[:300]}"
                if init.status_code == 401 and attempt < 3:
                    # Sesi login kedaluwarsa di tengah proses: ambil token baru lalu ulangi.
                    time.sleep(1)
                    continue
                if init.status_code in (429, 500, 502, 503) and attempt < 3:
                    time.sleep(2 * (attempt + 1))
                    continue
                raise RuntimeError(f"Gagal menyiapkan unggahan {file_name}: {last}")

            data = init.json()
            upload_url = data.get("uploadUrl")
            folder_id = data.get("folderId")
            if not upload_url:
                raise _NoResumable()

            with open(local_path, "rb") as fh:
                put = requests.put(
                    upload_url,
                    data=fh,
                    headers={"Content-Type": mime, "Content-Length": str(size)},
                    timeout=600,
                )
            if put.ok:
                file = put.json()
                file_id = file.get("id")
                link = file.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view"
                self._finalize(file_id)
                return {
                    "id": file_id,
                    "name": file.get("name", file_name),
                    "folderId": folder_id,
                    "webViewLink": link,
                }
            last = f"[{put.status_code}] {put.text[:300]}"
            if put.status_code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            break
        raise RuntimeError(f"Gagal unggah {os.path.basename(local_path)}: {last}")

    # ---------- hapus ----------
    def delete_event_folder(self, folder_name: str, file_ids: list | None = None) -> dict:
        """Hapus folder event beserta seluruh fotonya di Google Drive."""
        res = requests.post(
            f"{self.base}/api/public/companion/delete-event",
            json={"subfolder": folder_name, "fileIds": file_ids or []},
            headers=self._headers(),
            timeout=300,
        )
        if res.status_code == 404:
            raise RuntimeError(
                "Web app belum mendukung hapus folder Drive. Perbarui web app terlebih dahulu."
            )
        if not res.ok:
            raise RuntimeError(f"Gagal hapus folder Drive: [{res.status_code}] {res.text[:300]}")
        return res.json()

    def _finalize(self, file_id: str) -> None:

        try:
            requests.post(
                f"{self.base}/api/public/companion/finalize",
                json={"fileId": file_id},
                headers=self._headers(),
                timeout=60,
            )
        except requests.RequestException:
            pass

    def _upload_base64(self, folder_name: str, local_path: str, file_name: str, mime: str) -> dict:
        size = os.path.getsize(local_path)
        if size > FALLBACK_MAX_BYTES:
            raise RuntimeError(
                f"Gagal unggah {os.path.basename(local_path)}: ukuran "
                f"{round(size / 1024 / 1024, 1)} MB melebihi batas unggah lewat web app. "
                "Perbarui web app agar mendukung unggahan langsung ke Google Drive."
            )
        with open(local_path, "rb") as fh:
            payload = base64.b64encode(fh.read()).decode("ascii")
        body = {
            "subfolder": folder_name,
            "fileName": file_name,
            "mimeType": mime,
            "base64": payload,
        }
        last = ""
        for attempt in range(3):
            res = requests.post(
                f"{self.base}/api/public/companion/upload",
                json=body,
                headers=self._headers(),
                timeout=300,
            )
            if res.ok:
                return res.json()
            last = f"[{res.status_code}] {res.text[:300]}"
            if res.status_code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
        raise RuntimeError(f"Gagal unggah {os.path.basename(local_path)}: {last}")


class _NoResumable(Exception):
    """Endpoint resumable belum tersedia di web app."""
