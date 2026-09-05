# SuperIT Event Uploader (deliverable terpisah, desktop)

Web app tidak menjalankan face engine sama sekali. Semua proses AI ada di companion app.

## Koneksi

- Login ke Supabase project yang sama memakai akun admin (role `it_admin`/`superadmin`).
  Policy tabel `worker_faces` dan `event_photos` hanya mengizinkan tulis oleh admin,
  jadi tidak perlu `service_role` penuh.
- Google Drive API (OAuth admin atau service account), folder tetap:
  `SUPER IT DATA > Event > {nama_event}`.

## Sync data master (tiap app dibuka / tombol refresh)

1. `select * from worker_faces where status = 'pending'`.
2. Download `reference_photo_url`, jalankan deteksi + embedding (insightface, 512 dim).
3. Tepat satu wajah → update `embedding`, `status = 'indexed'`, `updated_at`.
4. Tidak ada wajah / lebih dari satu wajah → `status = 'failed'` + isi `note`.
5. Muat semua baris `status = 'indexed'` ke memori sebagai basis pencocokan.

## Proses foto event

1. Form event: judul, deskripsi, tanggal.
2. Cek/buat folder Drive `SUPER IT DATA > Event > {nama_event}` (jangan duplikat).
3. Insert/update `events` (`nama_event`, `deskripsi`, `tanggal_mulai`, `drive_folder_id`).
4. Pilih banyak file/folder lokal, jalankan proses.
5. Per foto: deteksi semua wajah → embedding → cocokkan
   (`select * from match_worker_faces(embedding, threshold, k)`, default threshold 0.6, configurable).
6. Rename file: `EVT-{event_id}_{personal_number}_{original_name}.jpg`.
7. Upload ke `drive_folder_id`, retry exponential backoff saat HTTP 429.
8. Insert `event_photos` (`event_id`, `drive_file_id`, `drive_view_link`, `file_name`,
   `matched_worker_ids`, `uploaded_by`).
9. Progress bar + log per foto.
10. Resume-safe: simpan state lokal foto yang sudah selesai.

## Distribusi

Daftarkan installer di tabel `companion_apps` (`name`, `description`, `version`,
`changelog`, `download_url`) agar muncul di menu **SuperIT Plug In** tanpa deploy ulang web app.
