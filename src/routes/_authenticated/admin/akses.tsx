import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AdminPage } from "@/components/AdminLayout";
import { Checkbox } from "@/components/ui/checkbox";
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
      { title: "Akses Halaman — Panel BRI BO Pringsewu" },
      { name: "description", content: "Pengaturan menu yang boleh diakses tiap level akses." },
      { property: "og:title", content: "Akses Halaman — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Pengaturan hak akses menu per level akses." },
    ],
  }),
  component: () => (
    <AdminPage menuKey="akses">
      <Page />
    </AdminPage>
  ),
});

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
      <h1 className="text-2xl font-bold">
        <span className="gradient-text">Akses Halaman</span>
      </h1>
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

