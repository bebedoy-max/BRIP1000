# Perjelas Label Kolom dan Kelompokkan Berita

## Ringkasan
- Membuat lima label kolom dashboard lebih menonjol, masing-masing dengan ikon dan aksen warna berbeda, tetap selaras dengan tampilan infografis.
- Mengelompokkan berita ke lima tab: Dunia, Nasional, Teknologi, BRI, dan Kebijakan.
- Menyederhanakan jendela baca berita: menghapus tombol silang atas dan mengubah tombol kanan bawah menjadi **Tutup**.

## Implementasi
- Buat komponen label kolom bersama agar gaya konsisten tetapi warna tiap kolom berbeda.
- Terapkan label baru pada Papan Informasi, Info Pasar, Suku Bunga BRI, Upcoming Event, dan Berita.
- Ubah sumber berita agar setiap item memiliki kategori berdasarkan kueri topiknya; tampilkan maksimal daftar relevan pada tab aktif.
- Gunakan kontrol tab yang mudah dibaca dan dapat dioperasikan dengan keyboard.
- Tombol **Tutup** hanya menutup jendela baca; tautan menuju sumber asli tidak lagi ditampilkan di bagian bawah.

## Verifikasi
- Pastikan kelima tab berisi berita sesuai topiknya dan perpindahan tab bekerja.
- Pastikan label terlihat jelas di layar desktop dan ponsel.
- Pastikan jendela berita dapat ditutup dari tombol bawah, klik area luar, dan tombol Escape.
- Periksa tampilan serta tidak ada galat aplikasi.
