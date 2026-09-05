#!/usr/bin/env python3
"""Titik masuk SuperIT Event Uploader. Jalankan: python run.py

Catatan penting: di Windows aplikasi dijalankan dengan pythonw.exe (tanpa
konsol), sehingga sys.stdout/sys.stderr bernilai None. Pustaka insightface &
onnxruntime menulis progres unduhan model ke stdout -> error
"'NoneType' object has no attribute 'write'". Karena itu stdout/stderr
dialihkan ke berkas log sebelum modul apa pun diimpor.
"""

import os
import sys


def _ensure_streams() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return
    log_dir = os.path.join(os.path.expanduser("~"), ".superit-event-uploader-logs")
    try:
        os.makedirs(log_dir, exist_ok=True)
        stream = open(os.path.join(log_dir, "runtime.log"), "a", encoding="utf-8", buffering=1)
    except OSError:
        stream = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


_ensure_streams()

from superit_companion.app import main  # noqa: E402

if __name__ == "__main__":
    main()
