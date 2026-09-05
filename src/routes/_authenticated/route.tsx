import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  isAccountRegistered,
  rejectUnregisteredAccount,
  syncAccessLevel,
} from "@/lib/registration";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Akun wajib terhubung ke Data Pekerja (Personal Number terverifikasi).
    if (!(await isAccountRegistered())) {
      await rejectUnregisteredAccount();
      if (typeof window !== "undefined")
        sessionStorage.setItem("unregistered_account", "1");
      throw redirect({ to: "/auth" });
    }

    // Selaraskan level akses dengan jabatan pada Data Pekerja.
    await syncAccessLevel();
    return { user: data.user };
  },
  component: () => <Outlet />,
});
