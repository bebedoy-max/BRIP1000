# SuperIT Event Uploader v1.2.14

Aplikasi desktop pendamping panel SuperIT. Semua proses face recognition
(deteksi wajah, embedding 512 dimensi, pencocokan) berjalan di sini —
web app hanya menampilkan hasilnya.

Tampilan mengikuti tema web app (Dark Blue Metallic) dan konfigurasi server
(Supabase URL + kunci publik) sudah tertanam otomatis mengikuti web app,
sehingga user cukup login memakai akun admin panel.

## Prasyarat

1. Python 3.11–3.12 64-bit (Python 3.11 direkomendasikan di Windows).
2. SQL `sql/face-recognition.sql` sudah dijalankan di Supabase.
3. Akun admin panel (`it_admin` / `superadmin`).
4. Akun Google Drive aktif sudah dipilih pada menu Google Drive di web app.

## Instalasi

```bash
cd companion
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Model `buffalo_l` (insightface) terunduh otomatis saat pertama kali dipakai.

## Konfigurasi

Hanya email & password admin, alamat web app, dan threshold kemiripan
(default 0.6) yang perlu diisi — tersimpan di `~/.superit-event-uploader.json`.
URL database dan kunci publik mengikuti konfigurasi web app. Google Drive juga
memakai akun yang sedang aktif di web app; tidak memerlukan `client_secret.json`.

## Alur pemakaian

1. **Koneksi** → isi akun admin, klik **Hubungkan** (login + muat model).
2. **Sinkron Wajah** → semua `worker_faces` berstatus `pending`/`failed` diproses:
   wajah utama terdeteksi → `indexed`, tidak terdeteksi → `failed` + catatan.
3. **Proses Foto Event**:
   - pilih event yang ada atau buat event baru,
   - pilih file/folder foto,
   - klik **Proses & Upload**.
   Per foto: deteksi semua wajah → embedding → `match_worker_faces` →
   rename `EVT-{event_id}_{personal_number}_{nama_asli}` → upload ke
   `SUPER IT DATA > Event > {nama_event}` (retry saat HTTP 429) →
   insert `event_photos` dengan `matched_worker_ids`.

Proses bersifat resume-safe: daftar foto yang sudah selesai disimpan di
`~/.superit-companion-state.json`, jadi bisa dilanjutkan kapan saja.
