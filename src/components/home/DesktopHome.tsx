import { CalendarClock, ChartNoAxesCombined, Landmark, MonitorPlay } from "lucide-react";
import { BankRatesPanel } from "@/components/home/BankRatesPanel";
import { HomeCarousel } from "@/components/home/HomeCarousel";
import { InfoBoard } from "@/components/home/InfoBoard";
import { InfographicStats, type InfographicStat } from "@/components/home/InfographicStats";
import { MarketPanel } from "@/components/home/MarketPanel";
import { NewsPanel } from "@/components/home/NewsPanel";
import { TabbedPanel } from "@/components/home/TabbedPanel";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { WorkerSlider } from "@/components/home/WorkerSlider";

/**
 * Susunan dashboard desktop (lg ke atas). Dua kolom (xl): kolom utama + rel kanan 350px.
 * Kolom utama: carousel (menyerap sisa tinggi) lalu [Papan Informasi/Upcoming Event bertab | Berita].
 * Rel kanan: Infografis 2 kolom, [Info Pasar/Suku Bunga bertab], Slide Pekerja (menyerap sisa tinggi).
 * Kedua kolom sama tinggi sehingga tepi bawahnya rata.
 */
export function DesktopHome({ infographics }: { infographics: InfographicStat[] }) {
  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-h-0 flex-1 [&>*]:h-full">
          <HomeCarousel />
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <TabbedPanel
            tabs={[
              {
                key: "info",
                label: "Papan Informasi",
                icon: MonitorPlay,
                content: <InfoBoard embedded />,
              },
              {
                key: "agenda",
                label: "Upcoming Event",
                icon: CalendarClock,
                content: <UpcomingEvents embedded />,
              },
            ]}
          />
          <NewsPanel />
        </div>
      </div>

      <div className="grid content-start items-stretch gap-4 lg:grid-cols-2 xl:flex xl:flex-col">
        <div className="lg:col-span-2 xl:col-auto">
          <InfographicStats items={infographics} />
        </div>
        <TabbedPanel
          tabs={[
            {
              key: "pasar",
              label: "Info Pasar",
              icon: ChartNoAxesCombined,
              content: <MarketPanel embedded />,
            },
            {
              key: "bunga",
              label: "Suku Bunga",
              icon: Landmark,
              content: <BankRatesPanel embedded />,
            },
          ]}
        />
        <div className="min-h-0 xl:flex-1 [&>*]:h-full">
          <WorkerSlider fill />
        </div>
      </div>
    </div>
  );
}
