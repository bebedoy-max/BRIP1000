// State OAuth bertanda tangan (HMAC): menolak callback yang tidak dimulai dari panel admin.

const TTL_MS = 10 * 60_000;

function secret(): string {
  const s =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["CUSTOM_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Kunci server tidak tersedia untuk menandatangani state OAuth.");
  return s;
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Buat state: `<idAkun>.<kedaluwarsa>.<tandaTangan>`. */
export async function signOAuthState(accountId: string): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const payload = `${accountId}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Kembalikan id akun bila state sah & belum kedaluwarsa; selain itu null. */
export async function verifyOAuthState(state: string | null): Promise<string | null> {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts as [string, string, string];
  if (!id || Number(exp) < Date.now()) return null;
  const expected = await hmac(`${id}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}
