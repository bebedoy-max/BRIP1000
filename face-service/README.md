# SuperIT Face Service (VPS)

Mesin pembaca wajah untuk fitur **Upload Foto Event** di web. Engine-nya sama dengan
companion app (insightface `buffalo_l`, 512 dimensi), jadi data wajah lama tetap cocok.

## Jalankan di VPS

```sh
cd face-service
docker build -t superit-face .
docker run -d --name superit-face --restart unless-stopped -p 8010:8010 \
  -v insightface:/root/.insightface \
  -e SUPABASE_URL="https://<url-supabase>" \
  -e SUPABASE_ANON_KEY="<anon-key>" \
  -e ALLOWED_ORIGINS="https://www.bripringsewu.web.id" \
  superit-face
```

Pasang HTTPS di depannya (Caddy/Nginx), mis. `https://face.domain-anda.id` -> `127.0.0.1:8010`.
Web berjalan di HTTPS, jadi service wajib HTTPS (mixed content diblokir browser).

## Hubungkan ke web

Set environment variable di Vercel lalu redeploy:

```
VITE_FACE_SERVICE_URL=https://face.domain-anda.id
```

## Keamanan

Setiap request wajib membawa token login Supabase; service memverifikasinya ke Supabase
dan hanya menerima role `it_admin`, `superadmin`, `event_admin`. Service tidak menyimpan foto.

## Endpoint

- `GET /health`
- `POST /embed` (multipart `file`) -> semua embedding wajah pada foto event
- `POST /master` (multipart `file`) -> wajah utama + kualitas untuk foto master
