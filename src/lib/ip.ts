/**
 * Tampilan alamat IPv4: hilangkan angka 0 di depan tiap oktet (040.030.041.001 → 40.30.41.1).
 * Penyimpanan & pengetikan tetap memakai format 3 digit; fungsi ini hanya untuk tampilan.
 */
export function ipDisplay(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return raw;
  return raw
    .split(".")
    .map((o) => String(Number(o)))
    .join(".");
}
