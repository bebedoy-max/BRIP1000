/**
 * Utilitas untuk menangani kepulangan dari penyedia OAuth (Google).
 *
 * Supabase mengembalikan hasil login pada query string (`?code=...`,
 * `?error=...`) atau pada hash (`#access_token=...`, `#error=...`).
 * Fungsi di sini membaca parameter tersebut tanpa bergantung pada penanda
 * yang tersimpan di localStorage, sehingga aplikasi tetap bisa menjelaskan
 * kegagalan meskipun penyimpanan browser sudah kosong.
 */

export type OAuthReturn = {
  code?: string;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
};

export function readOAuthReturn(): OAuthReturn | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const rawError =
    q.get("error_description") || q.get("error") || h.get("error_description") || h.get("error");
  if (rawError) return { error: decodeURIComponent(rawError.replace(/\+/g, " ")) };

  const code = q.get("code");
  if (code) return { code };

  const accessToken = h.get("access_token");
  const refreshToken = h.get("refresh_token");
  if (accessToken && refreshToken) return { accessToken, refreshToken };

  return null;
}

/** Menghapus parameter OAuth dari address bar agar tidak terpakai dua kali. */
export function stripOAuthParams() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", window.location.pathname);
}

/** Pesan yang mudah dipahami untuk kegagalan penukaran kode OAuth. */
export function describeOAuthFailure(raw?: string): string {
  const msg = raw ?? "";
  if (/code verifier|both auth code and code verifier/i.test(msg))
    return (
      "Google sudah mengirim kode login, tetapi browser ini tidak memiliki data verifikasinya. " +
      "Biasanya karena proses login selesai di domain/tab yang berbeda dari tempat Anda memulainya. " +
      "Pastikan URL aplikasi ini terdaftar di Supabase → Authentication → URL Configuration " +
      "(Site URL dan Redirect URLs), lalu ulangi dari halaman ini."
    );
  if (/invalid flow state|flow state/i.test(msg))
    return (
      "Proses login Google kedaluwarsa atau dimulai dari halaman lain. " +
      "Ulangi dari tombol \"Daftar dengan Google\" di halaman ini tanpa menutup/menyegarkan tab, " +
      "dan pastikan URL aplikasi terdaftar di Supabase → Authentication → URL Configuration."
    );
  if (/database error saving new user/i.test(msg))
    return (
      "Database menolak pembuatan akun baru (trigger pendaftaran gagal). " +
      "Jalankan blok perbaikan terakhir pada supabase/schema.sql di SQL Editor Supabase, lalu ulangi."
    );
  if (/access_denied|cancel/i.test(msg)) return "Proses masuk dengan Google dibatalkan.";
  if (/expired|invalid.*code/i.test(msg))
    return "Kode login Google sudah kedaluwarsa atau sudah dipakai. Silakan ulangi proses registrasi.";
  return msg || "Sesi Google tidak terbentuk. Silakan ulangi proses login.";
}
