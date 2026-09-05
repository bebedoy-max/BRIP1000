"""Alur kerja: sinkron wajah master + proses foto event."""

import json
import os
from typing import Callable, Dict, List, Optional

import requests

from .backend import Backend
from .drive import Drive
from .faces import FaceEngine, read_image

STATE_PATH = os.path.join(os.path.expanduser("~"), ".superit-companion-state.json")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

Log = Callable[[str], None]
Progress = Callable[[int, int], None]


def _load_state() -> Dict[str, List[str]]:
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return {}
    return {}


def _save_state(state: Dict[str, List[str]]) -> None:
    with open(STATE_PATH, "w", encoding="utf-8") as fh:
        json.dump(state, fh)


def collect_images(paths: List[str]) -> List[str]:
    out: List[str] = []
    for p in paths:
        if os.path.isdir(p):
            for root, _dirs, files in os.walk(p):
                for f in sorted(files):
                    if os.path.splitext(f)[1].lower() in IMAGE_EXT:
                        out.append(os.path.join(root, f))
        elif os.path.splitext(p)[1].lower() in IMAGE_EXT:
            out.append(p)
    return out


def sync_master_faces(backend: Backend, engine: FaceEngine, log: Log, progress: Progress) -> int:
    rows = backend.pending_faces()
    total = len(rows)
    log(f"Sinkronisasi wajah master: {total} data pending.")
    done = 0
    for i, row in enumerate(rows, start=1):
        name = row.get("personal_number") or row.get("id")
        url = row.get("reference_photo_url")
        try:
            if not url:
                backend.set_face_failed(row["id"], "Foto master belum diunggah")
                log(f"[{i}/{total}] {name}: tidak ada foto.")
            else:
                resp = requests.get(url, timeout=60)
                resp.raise_for_status()
                img = read_image(resp.content)
                if img is None:
                    backend.set_face_failed(row["id"], "File foto tidak terbaca")
                    log(f"[{i}/{total}] {name}: file tidak terbaca.")
                else:
                    res = engine.single_face(img)
                    if res is None:
                        backend.set_face_failed(
                            row["id"], "Wajah tidak terdeteksi pada foto master"
                        )
                        log(
                            f"[{i}/{total}] {name}: wajah tidak terdeteksi "
                            "(sudah dicoba rotasi, perbaikan kontras, upscale, dan crop scan)."
                        )
                    else:
                        emb, quality = res
                        backend.set_face_indexed(row["id"], emb, quality)
                        done += 1
                        log(f"[{i}/{total}] {name}: terindeks (kualitas {round(quality * 100)}%).")
        except Exception as err:  # noqa: BLE001
            log(f"[{i}/{total}] {name}: gagal — {err}")
        progress(i, total)
    log(f"Selesai. {done} wajah terindeks, total indeks aktif: {backend.indexed_count()}.")
    return done


def process_event_photos(
    backend: Backend,
    engine: FaceEngine,
    drive: Drive,
    event: Dict[str, str],
    files: List[str],
    log: Log,
    progress: Progress,
    should_stop: Optional[Callable[[], bool]] = None,
) -> None:
    event_id = event["id"]
    folder_id = event.get("drive_folder_id")
    folder_ref = drive.event_folder(event["nama_event"])
    log(f"Folder Drive event: {event['nama_event']}.")

    state = _load_state()
    done_list = set(state.get(event_id, []))
    total = len(files)
    log(f"Memproses {total} foto untuk event {event['nama_event']}.")

    for i, path in enumerate(files, start=1):
        if should_stop and should_stop():
            log("Dihentikan pengguna.")
            break
        key = os.path.abspath(path)
        if key in done_list:
            log(f"[{i}/{total}] {os.path.basename(path)}: dilewati (sudah diproses).")
            progress(i, total)
            continue
        try:
            img = read_image(path)
            if img is None:
                log(f"[{i}/{total}] {os.path.basename(path)}: tidak terbaca.")
                progress(i, total)
                continue

            matched_ids: List[str] = []
            personal_numbers: List[str] = []
            for emb in engine.embeddings(img):
                for m in backend.match(emb):
                    wid = m.get("worker_id")
                    if wid and wid not in matched_ids:
                        matched_ids.append(wid)
                        if m.get("personal_number"):
                            personal_numbers.append(m["personal_number"])

            base = os.path.basename(path)
            pn = "-".join(personal_numbers) if personal_numbers else "NOMATCH"
            new_name = f"EVT-{event_id}_{pn}_{base}"

            created = drive.upload(folder_ref, path, new_name)
            if created.get("folderId") and not folder_id:
                folder_id = created["folderId"]
                backend.set_event_folder(event_id, folder_id)
            file_id = created["id"]
            link = created.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view"

            if not backend.photo_exists(file_id):
                backend.insert_photo(event_id, file_id, link, new_name, matched_ids)

            done_list.add(key)
            state[event_id] = sorted(done_list)
            _save_state(state)
            log(f"[{i}/{total}] {base}: {len(matched_ids)} pekerja cocok → diunggah.")
        except Exception as err:  # noqa: BLE001
            log(f"[{i}/{total}] {os.path.basename(path)}: gagal — {err}")
        progress(i, total)

    log("Proses foto event selesai.")
