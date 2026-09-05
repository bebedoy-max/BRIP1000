/**
 * Menyamarkan nilai rahasia (API key, token, secret, dsb.) yang tidak sengaja
 * tertulis di dalam teks catatan agar tidak tampil utuh di dashboard.
 */

// Pola baris berlabel rahasia, mis. "SECRET KEY = ...", "ANON KEY PUBLIC = ..."
const LABELLED_SECRET =
  /^(\s*[^\n:=]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[^\n:=]*\s*[:=]\s*)(\S+.*)$/gim;

// Nilai mentah tanpa label: JWT, kunci Supabase, secret Google OAuth, client id.
const RAW_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
  /sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g,
  /GOCSPX-[A-Za-z0-9_-]+/g,
  /\b\d{6,}-\w+\.apps\.googleusercontent\.com\b/g,
];

function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 6) return "••••••";
  return `${trimmed.slice(0, 4)}${"•".repeat(10)}`;
}

export function maskSensitiveText(text: string | null | undefined): string {
  if (!text) return "";
  let out = text.replace(LABELLED_SECRET, (_m, label: string, value: string) => {
    return `${label}${maskValue(value)}`;
  });
  for (const pattern of RAW_PATTERNS) {
    out = out.replace(pattern, (m) => maskValue(m));
  }
  return out;
}
