import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AdminPage } from "@/components/AdminLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles } from "@/lib/roles";
import {
  DEFAULT_FONT,
  DEFAULT_THEME,
  fontOptions,
  themePresets,
  useAppearance,
  useSaveAppearance,
} from "@/lib/appearance";
import {
  accessLevels,
  menuItems,
  PUBLIC_LEVEL,
  PUBLIC_LEVEL_LABEL,
  publicDefaults,
  usePageAccess,
  type AccessLevel,
  type PageAccessRow,
} from "@/lib/access";

const db = supabase as unknown as SupabaseClient;


export const Route = createFileRoute("/_authenticated/admin/akses")({
  head: () => ({
    meta: [
      { title: "Pengaturan Halaman — Panel BRI BO Pringsewu" },
      { name: "description", content: "Atur hak akses menu dan tampilan (tema warna & font) web app." },
      { property: "og:title", content: "Pengaturan Halaman — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Pengaturan akses menu dan tampilan aplikasi." },
    ],
  }),
  component: () => (
    <AdminPage menuKey="akses">
      <PengaturanHalaman />
    </AdminPage>
  ),
});

function PengaturanHalaman() {
  return (
    <>
      <h1 className="text-2xl font-bold">
        <span className="gradient-text">Pengaturan Halaman</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kelola hak akses menu dan tampilan web app secara menyeluruh.
      </p>

      <Tabs defaultValue="akses" className="mt-6">
        <TabsList>
          <TabsTrigger value="akses">Akses Menu</TabsTrigger>
          <TabsTrigger value="tampilan">Tampilan</TabsTrigger>
        </TabsList>
        <TabsContent value="akses" className="mt-4">
          <Page />
        </TabsContent>
        <TabsContent value="tampilan" className="mt-4">
          <TampilanTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function TampilanTab() {
  const { isSuperadmin } = useRoles();
  const appearance = useAppearance();
  const save = useSaveAppearance();
  const theme = appearance.data?.theme_key ?? DEFAULT_THEME;
  const font = appearance.data?.font_key ?? DEFAULT_FONT;

  function pilih(v: { theme_key?: string; font_key?: string }) {
    if (!isSuperadmin) return;
    save.mutate(v, {
      onSuccess: () => toast.success("Tampilan diperbarui"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="space-y-8">
      {!isSuperadmin ? (
        <p className="text-sm text-muted-foreground">
          Hanya Super Admin yang dapat mengubah tampilan aplikasi.
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Tema Warna</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tema mengubah warna seluruh halaman. Menu atau halaman baru yang ditambahkan nanti
          otomatis mengikuti tema yang dipilih di sini.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themePresets.map((t) => {
            const active = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                disabled={!isSuperadmin || save.isPending}
                onClick={() => pilih({ theme_key: t.key })}
                className={`glass-card p-4 text-left transition-transform hover:scale-[1.01] disabled:opacity-60 ${
                  active ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{t.label}</span>
                  {active ? <Check className="size-4 text-primary" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex gap-2">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="size-7 rounded-full border border-border/60"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Font Aplikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Semua font dihosting sendiri sehingga tetap tampil di hosting mana pun.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fontOptions.map((f) => {
            const active = f.key === font;
            return (
              <button
                key={f.key}
                type="button"
                disabled={!isSuperadmin || save.isPending}
                onClick={() => pilih({ font_key: f.key })}
                className={`glass-card p-4 text-left transition-transform hover:scale-[1.01] disabled:opacity-60 ${
                  active ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs tracking-wide text-muted-foreground uppercase">
                    {f.label}
                    {f.note ? ` · ${f.note}` : ""}
                  </span>
                  {active ? <Check className="size-4 text-primary" /> : null}
                </div>
                <p
                  className="mt-2 truncate text-2xl"
                  style={{ fontFamily: `"${f.label}", ui-sans-serif, system-ui, sans-serif` }}
                >
                  BRI BO Pringsewu 123
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Page() {
  const qc = useQueryClient();

  const rules = usePageAccess();

  const rows: PageAccessRow[] = rules.data ?? [];
  const findRule = (key: string, level: AccessLevel) =>
    rows.find((r) => r.page_key === key && r.akses_level === level);

  const canView = (key: string, level: AccessLevel) => {
    const rule = findRule(key, level);
    if (rule) return rule.allowed;
    return menuItems.find((m) => m.key === key)?.defaults.includes(level) ?? false;
  };
  const canEdit = (key: string, level: AccessLevel) => {
    const rule = findRule(key, level);
    if (rule) return rule.can_edit === true;
    return level === "admin" && canView(key, level);
  };

  const canPublic = (key: string) => {
    const rule = rows.find((r) => r.page_key === key && r.akses_level === PUBLIC_LEVEL);
    if (rule) return rule.allowed;
    return publicDefaults.includes(key);
  };

  const savePublic = useMutation({
    mutationFn: async (v: { key: string; allowed: boolean }) => {
      const { error } = await db
        .from("page_access")
        .upsert(
          { page_key: v.key, akses_level: PUBLIC_LEVEL, allowed: v.allowed, can_edit: false },
          { onConflict: "page_key,akses_level" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["page_access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (v: {
      key: string;
      level: AccessLevel;
      allowed: boolean;
      can_edit: boolean;
    }) => {
      const { error } = await db
        .from("page_access")
        .upsert(
          { page_key: v.key, akses_level: v.level, allowed: v.allowed, can_edit: v.can_edit },
          { onConflict: "page_key,akses_level" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["page_access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(key: string, level: AccessLevel, kind: "view" | "edit", next: boolean) {
    const view = kind === "view" ? next : next || canView(key, level);
    const edit = kind === "edit" ? next : next ? canEdit(key, level) : false;
    save.mutate({ key, level, allowed: view, can_edit: edit });
  }

  return (
    <>
      <h2 className="text-lg font-semibold">
        <span className="gradient-text">Akses Menu</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">

        Atur hak <span className="text-foreground">View</span> (lihat) dan{" "}
        <span className="text-foreground">Edit</span> (tambah/ubah/hapus) tiap level akses. Super
        Admin selalu memiliki akses penuh. Kolom{" "}
        <span className="text-foreground">Pengunjung Umum</span> mengatur data yang boleh dibuka
        dari dashboard umum tanpa login.
      </p>

      <div className="glass-card mt-6 overflow-x-auto p-1">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 rounded-tl-xl bg-secondary/40 p-3 text-left align-bottom font-semibold backdrop-blur-xl"
              >
                Menu
              </th>
              {accessLevels.map((l, idx) => (
                <th
                  key={l.value}
                  colSpan={2}
                  className={`bg-secondary/40 p-3 text-center font-semibold ${
                    idx > 0 ? "border-l border-border/60" : ""
                  }`}
                >
                  <span className="gradient-text">{l.label}</span>
                </th>
              ))}
              <th
                rowSpan={2}
                className="rounded-tr-xl border-l border-border/60 bg-secondary/40 p-3 text-center align-bottom font-semibold"
              >
                <span className="gradient-text">{PUBLIC_LEVEL_LABEL}</span>
                <span className="mt-1 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  View (tanpa login)
                </span>
              </th>
            </tr>
            <tr>
              {accessLevels.map((l, idx) => (
                <Fragment key={l.value}>
                  <th
                    className={`bg-secondary/20 px-2 pb-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase ${
                      idx > 0 ? "border-l border-border/60" : ""
                    }`}
                  >
                    View
                  </th>
                  <th
                    className="bg-secondary/20 px-2 pb-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    Edit
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {menuItems.map((m) => (
              <tr key={m.key} className="group">
                <td className="sticky left-0 z-10 border-t border-border/40 bg-card/70 p-3 backdrop-blur-xl transition-colors group-hover:bg-secondary/30">
                  <span className="flex items-center gap-2">
                    <m.icon className="size-4 text-muted-foreground" />
                    {m.label}
                  </span>
                </td>
                {accessLevels.map((l, idx) => {
                  const sa = l.value === "super_admin";
                  const view = sa ? true : canView(m.key, l.value);
                  const edit = sa ? true : canEdit(m.key, l.value);
                  return (
                    <Fragment key={l.value}>
                      <td
                        className={`border-t border-border/40 p-3 text-center transition-colors group-hover:bg-secondary/20 ${
                          idx > 0 ? "border-l border-border/60" : ""
                        }`}
                      >
                        <Checkbox
                          checked={view}
                          disabled={sa || save.isPending}
                          onCheckedChange={(c) => toggle(m.key, l.value, "view", c === true)}
                        />
                      </td>
                      <td
                        className="border-t border-border/40 p-3 text-center transition-colors group-hover:bg-secondary/20"
                      >
                        <Checkbox
                          checked={edit}
                          disabled={sa || save.isPending || !view}
                          onCheckedChange={(c) => toggle(m.key, l.value, "edit", c === true)}
                        />
                      </td>
                    </Fragment>
                  );
                })}
                <td className="border-t border-l border-border/60 p-3 text-center transition-colors group-hover:bg-secondary/20">
                  <Checkbox
                    checked={canPublic(m.key)}
                    disabled={savePublic.isPending}
                    onCheckedChange={(c) =>
                      savePublic.mutate({ key: m.key, allowed: c === true })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

