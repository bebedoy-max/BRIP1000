import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAccess, levelToLabel } from "@/lib/access";

const db = supabase as unknown as SupabaseClient;

/** Identitas gabungan: akun (profiles) ↔ Data Pekerja ↔ Kategori Jabatan. */
export type DirectoryEntry = {
  user_id: string;
  nama: string | null;
  email: string | null;
  personal_number: string | null;
  jabatan: string | null;
  uker: string | null;
  akses_level: string | null;
  is_petugas_it: boolean;
};

/**
 * Direktori pengguna aplikasi. Dibaca lewat RPC `app_directory`
 * (SECURITY DEFINER) karena tabel profiles hanya bisa dibaca sendiri.
 */
export function useDirectory() {
  const access = useAccess();
  const myId = access.session?.user.id ?? "";

  const q = useQuery({
    queryKey: ["app_directory"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("app_directory");
      if (!error && Array.isArray(data)) return data as DirectoryEntry[];

      // Fallback: minimal identitas diri sendiri bila fungsi belum tersedia.
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [] as DirectoryEntry[];
      const { data: prof } = await db
        .from("profiles")
        .select("id,nama,email,personal_number")
        .eq("id", uid)
        .maybeSingle();
      const p = (prof ?? null) as {
        id: string;
        nama: string | null;
        email: string | null;
        personal_number: string | null;
      } | null;
      return [
        {
          user_id: uid,
          nama: p?.nama ?? auth.user?.email ?? null,
          email: p?.email ?? auth.user?.email ?? null,
          personal_number: p?.personal_number ?? null,
          jabatan: null,
          uker: null,
          akses_level: null,
          is_petugas_it: false,
        },
      ] as DirectoryEntry[];
    },
  });

  const entries = useMemo(() => q.data ?? [], [q.data]);
  const byId = useMemo(() => {
    const m = new Map<string, DirectoryEntry>();
    for (const e of entries) m.set(e.user_id, e);
    return m;
  }, [entries]);

  const me = byId.get(myId) ?? null;

  function nameOf(id: string) {
    const e = byId.get(id);
    return e?.nama || e?.email || (id === myId ? "Saya" : "Petugas");
  }

  return {
    entries,
    byId,
    me,
    myId,
    nameOf,
    /** Level akses akun sendiri (dari user_roles, selalu tersedia). */
    myLevel: access.level,
    myLevelLabel: me?.akses_level ?? levelToLabel(access.level),
    /** Petugas IT = level Super Admin / Admin. */
    isPetugasIt: access.level === "super_admin" || access.level === "admin",
    /** Manajemen boleh melihat catatan seluruh petugas IT. */
    isManajemen: access.level === "super_admin" || access.level === "manajemen",
    loading: access.loading || q.isLoading,
  };
}
