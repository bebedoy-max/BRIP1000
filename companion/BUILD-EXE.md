# Membuat installer EXE (Windows)

Cukup dilakukan **satu kali** di satu PC Windows. Hasilnya satu file
`SuperITEventUploader.exe` yang bisa dicopy ke PC mana pun (tanpa Python).

## Langkah

1. Ekstrak `SuperITEventUploader-*-Windows.zip`.
2. Pastikan Python **3.11–3.12 64-bit** terpasang (disarankan Python 3.11;
   Python 3.10/3.13/3.14 tidak dipakai installer). Centang **Add Python to PATH**.
3. Klik dua kali `Build-EXE-Windows.bat`.
4. Tunggu 10–20 menit (mengunduh dependensi + PyInstaller).
5. Hasil ada di folder `dist-exe\SuperITEventUploader.exe`.

Skrip hanya menampilkan `SELESAI` setelah file EXE benar-benar terbentuk. Jika
pemasangan dependensi gagal, proses berhenti dengan status `BUILD GAGAL`.
Paket sudah menyertakan wheel InsightFace dan hanya memasang binary wheel;
Visual Studio Build Tools tidak diperlukan.

## Pakai di PC lain

Copy `SuperITEventUploader.exe` ke PC tujuan, klik dua kali. Saat pertama
dijalankan aplikasi mengunduh model wajah (butuh internet) ke
`%USERPROFILE%\.insightface`.

## Catatan

- Ukuran EXE ± 300–500 MB karena berisi onnxruntime + OpenCV.
- Windows SmartScreen bisa muncul (EXE belum bertanda tangan digital):
  klik **More info → Run anyway**.
- Log aplikasi: `%USERPROFILE%\.superit-event-uploader-logs`.
