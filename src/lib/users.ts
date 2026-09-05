import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { menuItems } from "@/lib/access";

const db = supabase as unknown as SupabaseClient;

/** Ambang batas dianggap sedang online (ms). */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export type AdminUser = {
  id: string;
  email: string | null;
  nama: string | null;
  username: string | null;
  is_active: boolean;
  is_blocked: boolean;
  roles: string[];
  last_online: string | null;
  last_activity: string | null;
  last_activity_at: string | null;
  created_at: string | null;
};

export function isOnline(u: Pick<AdminUser, "last_online" | "is_blocked">) {
  if (u.is_blocked || !u.last_online) return false;
  return Date.now() - new Date(u.last_online).getTime() < ONLINE_WINDOW_MS;
}

/** Fallback: baca langsung dari tabel bila RPC admin_list_users tidak tersedia. */
async function listUsersFallback(): Promise<AdminUser[]> {
  const { data: profiles, error } = await db
    .from("profiles")
    .select(
      "id,email,nama,username,is_active,is_blocked,last_online,last_activity,last_activity_at,created_at",
    )
    .order("last_online", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const rows = (profiles ?? []) as Omit<AdminUser, "roles">[];
  const { data: roleRows } = await db.from("user_roles").select("user_id,role");
  const byUser = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as { user_id: string; role: string }[]) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  }
  return rows.map((r) => ({ ...r, roles: byUser.get(r.id) ?? [] }));
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin_users"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_list_users");
      if (error) return listUsersFallback();
      return (data ?? []) as AdminUser[];
    },
  });
}


export async function setBlocked(userId: string, blocked: boolean) {
  const { error } = await db.rpc("admin_set_blocked", {
    p_user_id: userId,
    p_blocked: blocked,
  });
  if (error) throw error;
}

export async function deleteUser(userId: string) {
  const { error } = await db.rpc("admin_delete_user", { p_user_id: userId });
  if (error) throw error;
}

export async function setPassword(userId: string, password: string) {
  const { error } = await db.rpc("admin_set_password", {
    p_user_id: userId,
    p_password: password,
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/** Label aktivitas berdasarkan rute yang sedang dibuka. */
function activityLabel(path: string): string {
  const item = [...menuItems].sort((a, b) => b.to.length - a.to.length).find((m) => path === m.to);
  if (item) return item.label;
  const nested = [...menuItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((m) => m.to !== "/admin" && path.startsWith(m.to));
  return nested?.label ?? path;
}

/**
 * Mengirim denyut kehadiran (online) beserta aktivitas terakhir pengguna.
 * Dipanggil sekali dari layout admin.
 */
export function usePresenceHeartbeat() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let stop = false;
    const label = activityLabel(path);

    const ping = async () => {
      if (stop || typeof document === "undefined" || document.hidden) return;
      const { error } = await db.rpc("touch_presence", { p_activity: label });
      if (!error) return;
      // Fallback: tulis langsung ke profil sendiri (diizinkan RLS "profiles self update").
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      const now = new Date().toISOString();
      await db
        .from("profiles")
        .update({ last_online: now, last_activity: label, last_activity_at: now })
        .eq("id", id);
    };

    void ping();
    const id = setInterval(() => void ping(), 60_000);
    const onVisible = () => void ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path]);
}


/** Apakah akun yang sedang login sudah diblokir admin. */
export function useSelfBlocked() {
  return useQuery({
    queryKey: ["self_blocked"],
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return false;
      const { data: row } = await db
        .from("profiles")
        .select("is_blocked,is_active")
        .eq("id", id)
        .maybeSingle();
      const p = (row ?? null) as { is_blocked?: boolean; is_active?: boolean } | null;
      return Boolean(p?.is_blocked) || p?.is_active === false;
    },
  });
}

