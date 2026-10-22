import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Building2, CalendarDays, CreditCard, QrCode, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/AdminLayout";
import { ProjectSummary } from "@/components/ProjectSummary";
import { EventSummary } from "@/components/EventSummary";
import { DiarySummary } from "@/components/DiarySummary";
import { InfographicStats } from "@/components/home/InfographicStats";
import { HomeCarousel } from "@/components/home/HomeCarousel";
import { MobileHome } from "@/components/home/MobileHome";
import { WorkerSlider } from "@/components/home/WorkerSlider";
import { MarketPanel } from "@/components/home/MarketPanel";
import { BankRatesPanel } from "@/components/home/BankRatesPanel";
import { NewsPanel } from "@/components/home/NewsPanel";
import { InfoBoard } from "@/components/home/InfoBoard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Ringkasan Panel — BRI BO Pringsewu" },
      { name: "description", content: "Ringkasan data internal BRI Branch Office Pringsewu." },
      { property: "og:title", content: "Ringkasan Panel — BRI BO Pringsewu" },
      { property: "og:description", content: "Ringkasan data internal BRI BO Pringsewu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

async function count(table: string) {
  const { count: c } = await db.from(table).select("id", { count: "exact", head: true });
  return c ?? 0;
}

type MobileTab = "info" | "berita" | "pasar" | "agenda";
const mobileTabs: { key: MobileTab; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "berita", label: "Berita" },
  { key: "pasar", label: "Pasar & Kurs" },
  { key: "agenda", label: "Agenda" },
];

function Page() {
  // Mobile: satu kelompok panel per tab agar halaman tidak panjang berlapis.
  const [mTab, setMTab] = useState<MobileTab>("info");
  const show = (t: MobileTab) => (mTab === t ? "" : "hidden lg:block");
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => ({
      ukers: await count("ukers"),
      employees: await count("employees"),
      atm: (await count("atm_machines")) + (await count("crm_machines")),
      edc: await count("edc_machines"),
      qris: await count("qris_merchants"),
      projects: await count("projects"),
      events: await count("events"),
    }),
  });

  const cards = [
    {
      label: "Unit Kerja",
      value: stats.data?.ukers ?? "—",
      icon: Building2,
      hint: "Uker aktif terdaftar",
      detailKey: "uker",
    },
    {
      label: "ATM/CRM",
      value: stats.data?.atm ?? "—",
      icon: Banknote,
      hint: "Termonitor",
      detailKey: "atm",
    },
    {
      label: "Mesin EDC",
      value: stats.data?.edc ?? "—",
      icon: CreditCard,
      hint: "Merchant terpasang",
      detailKey: "edc",
    },
    {
      label: "Qris",
      value: stats.data?.qris ?? "—",
      icon: QrCode,
      hint: "Merchant QRIS",
      detailKey: "qris",
    },
    {
      label: "Pegawai",
      value: stats.data?.employees ?? "—",
      icon: Users,
      hint: "Seluruh unit kerja",
      detailKey: "pegawai",
    },
    {
      label: "Project IT",
      value: stats.data?.projects ?? "—",
      icon: CalendarDays,
      hint: "Project berjalan",
      detailKey: "project",
    },
    {
      label: "Event",
      value: stats.data?.events ?? "—",
      icon: CalendarDays,
      hint: "Acara & kegiatan",
      detailKey: "event",
    },
  ];

  const maxStat = Math.max(1, ...cards.map((c) => (typeof c.value === "number" ? c.value : 0)));
  const infographics = cards.map((c) => ({
    label: c.label,
    value: c.value,
    icon: c.icon,
    detailKey: c.detailKey,
    description: c.hint,
    ratio: typeof c.value === "number" ? (c.value / maxStat) * 100 : 8,
  }));

  return (
    <AdminLayout>
      <MobileHome
        hero={{ label: "Total Pekerja", value: stats.data?.employees ?? "—", detailKey: "pegawai" }}
        stats={[
          { label: "ATM / CRM", value: stats.data?.atm ?? "—", detailKey: "atm" },
          { label: "Mesin EDC", value: stats.data?.edc ?? "—", detailKey: "edc" },
          { label: "Merchant QRIS", value: stats.data?.qris ?? "—", detailKey: "qris" },
          { label: "Project IT", value: stats.data?.projects ?? "—", detailKey: "project" },
        ]}
      />
      <div className="mt-4 lg:mt-0">
        <HomeCarousel />
      </div>

      <div
        role="tablist"
        aria-label="Panel informasi"
        className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:hidden"
      >
        {mobileTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mTab === t.key}
            onClick={() => setMTab(t.key)}
            className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
              mTab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 lg:mt-4 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-3">
          <div className="hidden lg:block">
            <InfographicStats items={infographics} />
          </div>
          <div className={show("info")}>
            <WorkerSlider />
          </div>
        </div>
        <div className="grid content-start gap-4 lg:col-span-6">
          <div className={show("info")}>
            <InfoBoard />
          </div>
          <div className={show("berita")}>
            <NewsPanel />
          </div>
        </div>
        <div className="grid content-start gap-4 lg:col-span-3">
          <div className={show("pasar")}>
            <MarketPanel />
          </div>
          <div className={show("pasar")}>
            <BankRatesPanel />
          </div>
          <div className={show("agenda")}>
            <UpcomingEvents />
          </div>
        </div>
      </div>

      <section className="mt-10 border-t border-border/60 pt-8">
        <h2 className="event-title-glow mb-1 text-lg">The Event's BRI BO Pringsewu</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Galery foto acara dan kegiatan BRI Branch Office Pringsewu.
        </p>
        <EventSummary limit={6} />
      </section>

      <section className="mt-10 border-t border-border/60 pt-8">
        <h2 className="event-title-glow mb-4 text-lg">Project IT</h2>
        <ProjectSummary limit={4} />
      </section>

      <section className="mt-10 border-t border-border/60 pt-8">
        <h2 className="event-title-glow mb-1 text-lg">Kegiatan Harian IT</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Catatan kegiatan harian petugas IT terbaru beserta foto kegiatannya.
        </p>
        <DiarySummary limit={6} />
      </section>
    </AdminLayout>
  );
}
