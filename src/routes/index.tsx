import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Building2, CreditCard, Users, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/PublicLayout";
import { ProjectSummary } from "@/components/ProjectSummary";
import { EventSummary } from "@/components/EventSummary";
import { AuthSplash } from "@/components/AuthSplash";
import { InfographicStats } from "@/components/home/InfographicStats";
import { WorkerSlider } from "@/components/home/WorkerSlider";
import { HomeCarousel } from "@/components/home/HomeCarousel";
import { MarketPanel } from "@/components/home/MarketPanel";
import { BankRatesPanel } from "@/components/home/BankRatesPanel";
import { NewsPanel } from "@/components/home/NewsPanel";
import { InfoBoard } from "@/components/home/InfoBoard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { clearPostLogin, POST_LOGIN_TARGET } from "@/lib/post-login";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Monitoring — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Ringkasan unit kerja, mesin ATM, mesin EDC, dan pegawai BRI Branch Office Pringsewu secara real-time.",
      },
      { property: "og:title", content: "Dashboard Monitoring — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Monitoring unit kerja, ATM, EDC, dan pegawai BRI Branch Office Pringsewu.",
      },
    ],
  }),
  component: Index,
});

async function count(table: string, filter?: { col: string; val: unknown }) {
  let q = supabase.from(table as "ukers").select("id", { count: "exact", head: true });
  if (filter) q = q.eq(filter.col as "id", filter.val as string);
  const { count: c } = await q;
  return c ?? 0;
}

function Index() {
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  // Bila Supabase mengembalikan hasil login ke Site URL ("/"), teruskan ke /auth
  // lengkap dengan parameternya supaya prosesnya bisa diselesaikan / dijelaskan.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = window.location.search;
    const h = window.location.hash;
    const isOAuth = /[?&](code|error|error_description)=/.test(s) || /(access_token|error)=/.test(h);
    if (isOAuth) window.location.replace(`/auth${s}${h}`);
  }, []);

  // Pengguna yang sudah login selalu diarahkan ke panel admin; dashboard umum
  // hanya untuk pengunjung yang belum login.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    setRedirecting(true);
    const go = () => {
      if (!mounted) return;
      clearPostLogin();
      void navigate({ to: POST_LOGIN_TARGET, replace: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) go();
      else {
        clearPostLogin();
        setRedirecting(false);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => ({
      ukers: await count("ukers"),
      atm: (await count("atm_machines")) + (await count("crm_machines")),
      edc: await count("edc_machines"),
      employees: await count("employees"),
      projects: await count("projects"),
      events: await count("events"),
    }),
  });


  const cards = [
    { label: "Unit Kerja", value: stats.data?.ukers ?? "—", icon: Building2, hint: "Uker aktif terdaftar", detailKey: "uker" },
    { label: "ATM/CRM", value: stats.data?.atm ?? "—", icon: Banknote, hint: "Termonitor", detailKey: "atm" },
    { label: "Mesin EDC", value: stats.data?.edc ?? "—", icon: CreditCard, hint: "Merchant terpasang", detailKey: "edc" },
    { label: "Pegawai", value: stats.data?.employees ?? "—", icon: Users, hint: "Seluruh unit kerja", detailKey: "pegawai" },
    { label: "Project IT", value: stats.data?.projects ?? "—", icon: CalendarDays, hint: "Project berjalan", detailKey: "project" },
    { label: "Event", value: stats.data?.events ?? "—", icon: CalendarDays, hint: "Acara & kegiatan", detailKey: "event" },
  ];


  if (redirecting) return <AuthSplash label="Menyiapkan panel Anda..." />;

  const maxStat = Math.max(
    1,
    ...cards.map((c) => (typeof c.value === "number" ? c.value : 0)),
  );
  const infographics = cards.map((c) => ({
    label: c.label,
    value: c.value,
    icon: c.icon,
    detailKey: c.detailKey,
    description: c.hint,
    ratio: typeof c.value === "number" ? (c.value / maxStat) * 100 : 8,
  }));

  return (
    <PublicLayout>
      <HomeCarousel />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-3">
          <InfographicStats items={infographics} />
          <WorkerSlider />
        </div>
        <div className="grid content-start gap-4 lg:col-span-6">
          <InfoBoard />
          <NewsPanel />
        </div>
        <div className="grid content-start gap-4 lg:col-span-3">
          <MarketPanel />
          <BankRatesPanel />
          <UpcomingEvents />
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
    </PublicLayout>
  );
}

