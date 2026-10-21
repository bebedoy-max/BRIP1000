import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  isAccountRegistered,
  rejectUnregisteredAccount,
  syncAccessLevel,
} from "@/lib/registration";

/**
 * beforeLoad berjalan pada SETIAP perpindahan menu. Verifikasi pendaftaran & sinkron level
 * akses (beberapa round-trip ke database) cukup dilakukan sekali per akun dalam beberapa
 * menit; hak akses data tetap dijaga RLS di database dan middleware server.
 */
const VERIFY_TTL_MS = 10 * 60_000;
const verifiedUntil = new Map<string, number>();

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession membaca sesi lokal (tanpa jaringan), jauh lebih cepat dari getUser.
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    if ((verifiedUntil.get(user.id) ?? 0) < Date.now()) {
      // Akun wajib terhubung ke Data Pekerja (Personal Number terverifikasi).
      if (!(await isAccountRegistered())) {
        verifiedUntil.delete(user.id);
        await rejectUnregisteredAccount();
        if (typeof window !== "undefined") sessionStorage.setItem("unregistered_account", "1");
        throw redirect({ to: "/auth" });
      }

      // Selaraskan level akses dengan jabatan pada Data Pekerja.
      await syncAccessLevel();
      verifiedUntil.set(user.id, Date.now() + VERIFY_TTL_MS);
    }
    return { user };
  },
  component: () => <Outlet />,
});
