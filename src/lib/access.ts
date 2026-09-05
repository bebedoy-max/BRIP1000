import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Banknote,
  BookOpen,
  Brain,
  Boxes,
  Building2,
  CalendarClock,
  CalendarDays,
  Cloud,
  CreditCard,
  Database,
  GalleryHorizontal,
  Gauge,
  IdCard,
  Image,
  Laptop,
  LifeBuoy,
  ListChecks,
  MonitorPlay,
  NotebookPen,
  Puzzle,
  QrCode,
  ScrollText,
  Settings,
  Sunrise,
  SlidersHorizontal,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRoles, type AppRole } from "@/lib/roles";

const db = supabase as unknown as SupabaseClient;

/** Level akses aplikasi. */
export type AccessLevel = "super_admin" | "admin" | "manajemen" | "pekerja";

export const accessLevels: { value: AccessLevel; label: string; role: AppRole }[] = [
  { value: "super_admin", label: "Super Admin", role: "superadmin" },
  { value: "admin", label: "Admin", role: "it_admin" },
  { value: "manajemen", label: "Manajemen", role: "event_admin" },
  { value: "pekerja", label: "Pekerja", role: "employee" },
];

export const accessLevelLabels = accessLevels.map((l) => l.label);

/** Level yang boleh dipakai di Kategori Jabatan (Super Admin tidak bisa dipilih). */
export const jobAccessLevelLabels = accessLevels
  .filter((l) => l.value !== "super_admin")
  .map((l) => l.label);

export function labelToLevel(label: string | null | undefined): AccessLevel {
  return accessLevels.find((l) => l.label === label)?.value ?? "pekerja";
}

export function levelToLabel(level: AccessLevel): string {
  return accessLevels.find((l) => l.value === level)?.label ?? "Pekerja";
}

export function levelToRole(level: AccessLevel): AppRole {
  return accessLevels.find((l) => l.value === level)?.role ?? "employee";
}

export function rolesToLevel(roles: AppRole[]): AccessLevel {
  if (roles.includes("superadmin")) return "super_admin";
  if (roles.includes("it_admin")) return "admin";
  if (roles.includes("event_admin")) return "manajemen";
  return "pekerja";
}

export type MenuItem = {
  key: string;
  to: string;
  label: string;
  icon: typeof Gauge;
  /** Level yang diizinkan bila belum diatur di menu Akses Halaman. */
  defaults: AccessLevel[];
};

const ALL: AccessLevel[] = ["super_admin", "admin", "manajemen", "pekerja"];
const MGMT: AccessLevel[] = ["super_admin", "admin", "manajemen"];
const ADMIN_ONLY: AccessLevel[] = ["super_admin", "admin"];

export const menuItems: MenuItem[] = [
  { key: "ringkasan", to: "/admin", label: "Dashboard", icon: Gauge, defaults: ALL },
  { key: "uker", to: "/admin/uker", label: "Unit Kerja", icon: Building2, defaults: ALL },
  { key: "pegawai", to: "/admin/pegawai", label: "Data Pekerja", icon: Users, defaults: ALL },
  { key: "jabatan", to: "/admin/jabatan", label: "Kategori Jabatan", icon: IdCard, defaults: ADMIN_ONLY },
  { key: "atm", to: "/admin/atm", label: "Mesin ATM", icon: Banknote, defaults: MGMT },
  { key: "crm", to: "/admin/crm", label: "Mesin CRM", icon: Banknote, defaults: MGMT },
  { key: "edc", to: "/admin/edc", label: "Mesin EDC", icon: CreditCard, defaults: MGMT },
  { key: "qris", to: "/admin/qris", label: "Merchant QRIS", icon: QrCode, defaults: MGMT },
  { key: "jenis-perangkat", to: "/admin/jenis-perangkat", label: "Jenis Perangkat", icon: Boxes, defaults: ADMIN_ONLY },
  { key: "perangkat", to: "/admin/perangkat", label: "Data Perangkat IT", icon: Laptop, defaults: ADMIN_ONLY },
  { key: "project", to: "/admin/project", label: "Project IT", icon: CalendarDays, defaults: MGMT },
  {
    key: "project-progress",
    to: "/admin/project-progress",
    label: "Project Update Progress",
    icon: ListChecks,
    defaults: MGMT,
  },
  { key: "foto", to: "/admin/foto", label: "Event", icon: Image, defaults: ADMIN_ONLY },
  { key: "agenda", to: "/admin/agenda", label: "Agenda Upcoming Event", icon: CalendarClock, defaults: ADMIN_ONLY },
  {
    key: "papan-informasi",
    to: "/admin/papan-informasi",
    label: "Papan Informasi",
    icon: MonitorPlay,
    defaults: ADMIN_ONLY,
  },
  { key: "carousel", to: "/admin/carousel", label: "Konten Carousel", icon: GalleryHorizontal, defaults: ADMIN_ONLY },
  {
    key: "slide-pekerja",
    to: "/admin/slide-pekerja",
    label: "Slide Profil Pekerja",
    icon: IdCard,
    defaults: ADMIN_ONLY,
  },
  { key: "tools", to: "/admin/tools", label: "SuperIT Apps", icon: Wrench, defaults: ADMIN_ONLY },
  {
    key: "doa-pagi",
    to: "/admin/tools/doa-pagi",
    label: "Absensi, Doa & Briefing Pagi",
    icon: Sunrise,
    defaults: ALL,
  },
  {
    key: "setting-doa-pagi",
    to: "/admin/setting-doa-pagi",
    label: "Absensi Doa Pagi",
    icon: Sunrise,
    defaults: ADMIN_ONLY,
  },
  { key: "tutorial", to: "/admin/tutorial", label: "Tutorial", icon: BookOpen, defaults: ADMIN_ONLY },
  { key: "tiket", to: "/admin/tiket", label: "Tiket IT", icon: LifeBuoy, defaults: ALL },
  {
    key: "buku-harian",
    to: "/admin/buku-harian",
    label: "Buku Harian IT",
    icon: NotebookPen,
    defaults: ALL,
  },
  { key: "drive", to: "/admin/drive", label: "Google Drive", icon: Cloud, defaults: ADMIN_ONLY },
  { key: "plugin", to: "/admin/plugin", label: "Apps Ext", icon: Puzzle, defaults: ADMIN_ONLY },
  { key: "users", to: "/admin/users", label: "Daftar User", icon: UserCog, defaults: ADMIN_ONLY },
  {
    key: "akses",
    to: "/admin/akses",
    label: "Akses Halaman",
    icon: SlidersHorizontal,
    defaults: ["super_admin"],
  },
  {
    key: "ai-brain",
    to: "/admin/ai-brain",
    label: "AI Brain",
    icon: Brain,
    defaults: ["super_admin"],
  },
  { key: "audit", to: "/admin/audit", label: "Audit Log", icon: ScrollText, defaults: ["super_admin"] },
];

/** Struktur navigasi sidebar: item tunggal atau grup dengan anak menu. */
export type MenuNode =
  | { type: "item"; key: string }
  | { type: "group"; key: string; label: string; icon: typeof Gauge; keys: string[] };

export const menuTree: MenuNode[] = [
  { type: "item", key: "ringkasan" },
  {
    type: "group",
    key: "database",
    label: "Database",
    icon: Database,
    keys: ["uker", "pegawai", "atm", "crm", "edc", "qris", "perangkat"],
  },
  {
    type: "group",
    key: "project-event",
    label: "Project & Event",
    icon: CalendarDays,
    keys: ["project", "project-progress", "foto", "agenda"],
  },
  { type: "item", key: "tools" },
  { type: "item", key: "doa-pagi" },
  { type: "item", key: "tiket" },
  { type: "item", key: "buku-harian" },
  { type: "item", key: "plugin" },
  { type: "item", key: "tutorial" },
  {
    type: "group",
    key: "setting",
    label: "Setting",
    icon: Settings,
    keys: ["akses", "setting-doa-pagi", "users", "ai-brain", "drive", "jabatan", "jenis-perangkat", "carousel", "slide-pekerja", "papan-informasi"],
  },
  { type: "item", key: "audit" },
];


export type PageAccessRow = {
  page_key: string;
  akses_level: string;
  allowed: boolean;
  can_edit?: boolean;
};

export function usePageAccess() {
  return useQuery({
    queryKey: ["page_access"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("page_access")
        .select("page_key,akses_level,allowed,can_edit");
      if (error) return [] as PageAccessRow[];
      return (data ?? []) as PageAccessRow[];
    },
  });
}

/** Level khusus untuk pengunjung umum (belum login). */
export const PUBLIC_LEVEL = "publik";
export const PUBLIC_LEVEL_LABEL = "Pengunjung Umum";

/** Menu yang boleh ditampilkan pada dashboard umum bila belum diatur. */
export const publicDefaults: string[] = [];

/** Hak lihat detail untuk pengunjung umum (tanpa login). */
export function usePublicAccess() {
  const rules = usePageAccess();

  function canPublicView(key: string) {
    const rule = (rules.data ?? []).find(
      (x) => x.page_key === key && x.akses_level === PUBLIC_LEVEL,
    );
    if (rule) return rule.allowed;
    return publicDefaults.includes(key);
  }

  return { canPublicView, loading: rules.isLoading };
}




/** Hak akses menu untuk pengguna saat ini. */
export function useAccess() {
  const r = useRoles();
  const rules = usePageAccess();
  const level = rolesToLevel(r.roles);

  function canAccess(key: string) {
    if (level === "super_admin") return true;
    const item = menuItems.find((m) => m.key === key);
    if (!item) return false;
    const rule = (rules.data ?? []).find((x) => x.page_key === key && x.akses_level === level);
    if (rule) return rule.allowed;
    return item.defaults.includes(level);
  }

  /** Boleh mengubah data pada menu ini (tambah/edit/hapus). */
  function canEdit(key: string) {
    if (level === "super_admin") return true;
    if (!canAccess(key)) return false;
    const rule = (rules.data ?? []).find((x) => x.page_key === key && x.akses_level === level);
    if (rule) return rule.can_edit === true;
    return level === "admin";
  }

  return {
    ...r,
    level,
    levelLabel: levelToLabel(level),
    loading: r.loading || rules.isLoading,
    isAdminLevel: level === "super_admin" || level === "admin",
    canAccess,
    canEdit,
    visibleMenus: menuItems.filter((m) => canAccess(m.key)),
  };
}


/**
 * Hak lihat detail pada dashboard umum:
 * - pengunjung tanpa login mengikuti pengaturan level "Pengunjung Umum"
 * - pengguna login mengikuti hak akses menu miliknya
 */
export function useDetailAccess(key: string) {
  const access = useAccess();
  const pub = usePublicAccess();
  const loading = access.loading || pub.loading;
  const loggedIn = !!access.session;
  const allowed = loggedIn ? access.canAccess(key) : pub.canPublicView(key);
  return { loading, loggedIn, allowed, level: access.level };
}
