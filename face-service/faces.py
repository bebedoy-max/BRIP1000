"""Deteksi wajah + embedding 512 dimensi (insightface / buffalo_l)."""

import os
import sys
from typing import List, Optional, Tuple

import numpy as np


def _safe_streams() -> None:
    """pythonw.exe (Windows) membuat stdout/stderr = None; insightface menulis
    progres unduhan model ke sana dan gagal dengan NoneType.write."""
    if sys.stdout is not None and sys.stderr is not None:
        return
    try:
        log_dir = os.path.join(os.path.expanduser("~"), ".superit-event-uploader-logs")
        os.makedirs(log_dir, exist_ok=True)
        stream = open(os.path.join(log_dir, "runtime.log"), "a", encoding="utf-8", buffering=1)
    except OSError:
        stream = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


class FaceEngine:
    def __init__(self, det_size: int = 640):
        _safe_streams()
        from insightface.app import FaceAnalysis

        self.app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        # Turunkan ambang deteksi agar foto master kecil/terkompresi tidak mudah ditolak.
        # Kualitas tetap disimpan dari det_score supaya admin bisa menilai ulang foto yang lemah.
        self.app.prepare(ctx_id=-1, det_size=(det_size, det_size), det_thresh=0.2)

    @staticmethod
    def _normalize(vec: np.ndarray) -> List[float]:
        norm = np.linalg.norm(vec)
        if norm == 0:
            return vec.astype(float).tolist()
        return (vec / norm).astype(float).tolist()

    def embeddings(self, image: np.ndarray) -> List[List[float]]:
        """Semua wajah pada satu gambar."""
        faces = self.app.get(image)
        return [self._normalize(f.normed_embedding) for f in faces]

    def single_embedding(self, image: np.ndarray) -> Optional[List[float]]:
        res = self.single_face(image)
        return res[0] if res else None

    @staticmethod
    def _enhance(image: np.ndarray) -> np.ndarray:
        """Perbaiki kontras lokal + sharpen ringan untuk foto kecil/blur/kompresi."""
        import cv2

        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_channel = clahe.apply(l_channel)
        enhanced = cv2.cvtColor(cv2.merge((l_channel, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
        blurred = cv2.GaussianBlur(enhanced, (0, 0), 1.0)
        return cv2.addWeighted(enhanced, 1.35, blurred, -0.35, 0)

    @staticmethod
    def _rotations(image: np.ndarray) -> List[np.ndarray]:
        import cv2

        return [
            cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE),
            cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
            cv2.rotate(image, cv2.ROTATE_180),
        ]

    @staticmethod
    def _tiles(image: np.ndarray) -> List[np.ndarray]:
        """Potong gambar besar agar wajah jauh tidak terlalu mengecil saat dideteksi."""
        h, w = image.shape[:2]
        if min(h, w) < 520:
            return []

        tiles: List[np.ndarray] = []
        for grid in (2, 3):
            tile_w = max(w // grid, 1)
            tile_h = max(h // grid, 1)
            overlap_x = tile_w // 4
            overlap_y = tile_h // 4
            for row in range(grid):
                for col in range(grid):
                    x1 = max(0, col * tile_w - overlap_x)
                    y1 = max(0, row * tile_h - overlap_y)
                    x2 = min(w, (col + 1) * tile_w + overlap_x)
                    y2 = min(h, (row + 1) * tile_h + overlap_y)
                    crop = image[y1:y2, x1:x2]
                    if crop.size and min(crop.shape[:2]) >= 160:
                        tiles.append(crop)
        return tiles

    @staticmethod
    def _usable_faces(faces) -> List[object]:
        usable = []
        for face in faces:
            if getattr(face, "normed_embedding", None) is None:
                continue
            score = float(getattr(face, "det_score", 0.0) or 0.0)
            if score >= 0.12:
                usable.append(face)
        return usable

    def _detect(self, image: np.ndarray):
        """Deteksi bertahap: asli, peningkatan kualitas, upscale, rotasi, lalu crop scan."""
        import cv2

        attempts: List[Tuple[str, np.ndarray]] = [("asli", image), ("kontras", self._enhance(image))]
        h, w = image.shape[:2]
        for scale in (2.0, 3.0):
            if max(h, w) * scale > 4000:
                break
            resized = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
            attempts.append((f"upscale {scale:g}x", resized))
            attempts.append((f"upscale {scale:g}x + kontras", self._enhance(resized)))

        attempts.extend(("rotasi", rotated) for rotated in self._rotations(image))
        attempts.extend(("crop", tile) for tile in self._tiles(image))

        for _label, candidate in attempts:
            faces = self._usable_faces(self.app.get(candidate))
            if faces:
                return faces
        return []

    def single_face(self, image: np.ndarray):
        """(embedding, kualitas 0..1) dari wajah utama pada foto master.

        Jika ada beberapa wajah, ambil wajah terbesar/paling yakin (bukan gagal).
        """
        faces = self._detect(image)
        if not faces:
            return None

        def rank(f):
            box = getattr(f, "bbox", None)
            area = 0.0
            if box is not None:
                area = float(max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1]))
            return area * float(getattr(f, "det_score", 0.0) or 0.0)

        face = max(faces, key=rank)
        score = float(getattr(face, "det_score", 0.0) or 0.0)
        return self._normalize(face.normed_embedding), max(0.0, min(1.0, score))


def read_image(path_or_bytes) -> Optional["np.ndarray"]:
    import cv2

    try:
        from PIL import Image, ImageOps

        if isinstance(path_or_bytes, (bytes, bytearray)):
            import io

            pil_image = Image.open(io.BytesIO(path_or_bytes))
        else:
            pil_image = Image.open(path_or_bytes)
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        pass

    if isinstance(path_or_bytes, (bytes, bytearray)):
        buf = np.frombuffer(path_or_bytes, dtype=np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return cv2.imread(path_or_bytes)
