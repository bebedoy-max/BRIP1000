#!/bin/bash
# SuperIT Event Uploader 1.2.2 - Installer (macOS)
set -e
cd "$(dirname "$0")"

echo "================================================="
echo "  SuperIT Event Uploader 1.2.2 - Installer macOS"
echo "================================================="

PY=""
for CAND in python3.12 python3.11 python3.10; do
  if command -v "$CAND" >/dev/null 2>&1; then PY=$(command -v "$CAND"); break; fi
done
if [ -z "$PY" ] && command -v python3 >/dev/null 2>&1; then
  MINOR=$(python3 -c 'import sys; print(sys.version_info[1])')
  if [ "$MINOR" -ge 10 ] && [ "$MINOR" -le 12 ]; then PY=$(command -v python3); fi
fi
if [ -z "$PY" ]; then
  echo "[X] Python 3.10 - 3.12 tidak ditemukan (3.13/3.14 belum didukung insightface/onnxruntime)."
  echo "    Unduh Python 3.12 di https://www.python.org/downloads/"
  read -n 1 -s -r -p "Tekan tombol apa saja untuk keluar..."
  exit 1
fi
echo "Menggunakan: $PY ($($PY --version 2>&1))"

APPDIR="$HOME/Applications/SuperITEventUploader"
echo "[1/4] Menyalin file ke $APPDIR ..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR"
cp -R app/. "$APPDIR/"

echo "[2/4] Membuat virtual environment ..."
rm -rf "$APPDIR/.venv"
"$PY" -m venv "$APPDIR/.venv"

echo "[3/4] Memasang dependensi (butuh internet, +- 5 menit) ..."
"$APPDIR/.venv/bin/python" -m pip install --upgrade pip setuptools wheel >/dev/null
"$APPDIR/.venv/bin/python" -m pip install --no-cache-dir -r "$APPDIR/requirements.txt"

echo "[4/4] Membuat pintasan di Desktop ..."
LAUNCH="$APPDIR/SuperIT Event Uploader.command"
cat > "$LAUNCH" <<LAUNCHER
#!/bin/bash
cd "$APPDIR"
exec "$APPDIR/.venv/bin/python" run.py
LAUNCHER
chmod +x "$LAUNCH"
ln -sf "$LAUNCH" "$HOME/Desktop/SuperIT Event Uploader.command"

echo ""
echo "[OK] Instalasi selesai. Buka \"SuperIT Event Uploader\" dari Desktop."
echo "Catatan: klik kanan > Open bila macOS menampilkan peringatan Gatekeeper."
read -n 1 -s -r -p "Tekan tombol apa saja untuk keluar..."
