import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

/** Kunci penyimpanan sementara Personal Number sebelum sesi terbentuk (alur Google). */
export const PENDING_PN_KEY = "pending_personal_number";

/**
 * Mencocokkan Personal Number dengan Data Pekerja melalui RPC
 * `check_personal_number` (SECURITY DEFINER, boleh dipanggil anon).
 */
export async function checkPersonalNumber(
  pn: string,
  opts?: { allowExisting?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await db.rpc("check_personal_number", { p_pn: pn });
  if (error) return { ok: false, message: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { pn_exists?: boolean; pn_claimed?: boolean }
    | boolean
    | null;

  if (typeof row === "boolean") {
    return row ? { ok: true } : { ok: false, message: "Personal Number tidak ada di Data Pekerja" };
  }
  if (!row?.pn_exists) return { ok: false, message: "Personal Number tidak ada di Data Pekerja" };
  if (row.pn_claimed && !opts?.allowExisting)
    return { ok: false, message: "Personal Number ini sudah terdaftar sebagai pengguna" };
  return { ok: true };
}

/**
 * Menyesuaikan level akses akun dengan jabatan pada Data Pekerja
 * (kuota Super Admin 1, Admin 10; kelebihan otomatis turun ke Manajemen).
 */
export async function syncAccessLevel(): Promise<void> {
  try {
    await db.rpc("sync_my_access_level");
  } catch {
    /* abaikan bila fungsi belum tersedia */
  }
}

export type ClaimResult =
  | { status: "none" }
  | { status: "ok"; pn: string }
  | { status: "failed"; pn: string; message: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Menghubungkan akun yang baru login dengan Personal Number yang sudah diverifikasi.
 * Dicoba beberapa kali karena profil pengguna baru (trigger) bisa terbentuk sesaat
 * setelah sesi OAuth tersedia.
 */
export async function claimPendingPersonalNumber(): Promise<ClaimResult> {
  if (typeof window === "undefined") return { status: "none" };
  const pn = localStorage.getItem(PENDING_PN_KEY);
  if (!pn) {
    await syncAccessLevel();
    return { status: "none" };
  }

  let message = "Gagal menghubungkan Personal Number dengan akun ini.";
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db.rpc("claim_personal_number", { p_pn: pn });
    if (!error && data === true) {
      localStorage.removeItem(PENDING_PN_KEY);
      await syncAccessLevel();
      return { status: "ok", pn };
    }
    if (error) message = error.message;
    else
      message =
        "Personal Number ini sudah terhubung dengan akun lain, atau tidak ditemukan di Data Pekerja.";
    await sleep(500);
  }

  await syncAccessLevel();
  return { status: "failed", pn, message };
}

/**
 * Memastikan akun yang sedang login benar-benar terhubung ke Data Pekerja.
 * Mengembalikan false untuk akun asing (mis. login Google tanpa Personal Number).
 */
export async function isAccountRegistered(): Promise<boolean> {
  const { data, error } = await db.rpc("is_account_registered");
  if (!error) return data === true;

  // Fallback bila fungsi belum ada di database: cek profil sendiri.
  const { data: auth } = await db.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return false;
  const [{ data: prof }, { data: roles }] = await Promise.all([
    db.from("profiles").select("personal_number").eq("id", uid).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", uid),
  ]);
  const adminRole = (roles ?? []).some((r: { role: string }) =>
    ["superadmin", "it_admin", "event_admin"].includes(r.role),
  );
  const pn = (prof as { personal_number?: string } | null)?.personal_number;
  if (adminRole) return true;
  if (!pn) return false;
  const { count } = await db
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("personal_number", pn);
  return (count ?? 0) > 0;
}

/** Menolak akun yang tidak terdaftar: hapus jejaknya lalu keluar dari sesi. */
export async function rejectUnregisteredAccount(): Promise<void> {
  try {
    await db.rpc("discard_unregistered_account");
  } catch {
    /* abaikan */
  }
  await db.auth.signOut();
}
