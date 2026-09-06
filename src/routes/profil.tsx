import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sortByUker } from "@/lib/uker-order";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil Kantor — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Profil BRI Branch Office Pringsewu: alamat, jam layanan, kontak, dan daftar unit kerja di bawah koordinasinya.",
      },
      { property: "og:title", content: "Profil Kantor — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Alamat, jam layanan, kontak, dan daftar unit kerja BRI BO Pringsewu.",
      },
    ],
  }),
  component: Profil,
});

const info = [
  { icon: MapPin, label: "Alamat", value: "Jl. Jend. Ahmad Yani No. 12, Pringsewu, Lampung" },
  { icon: Clock, label: "Jam Layanan", value: "Senin – Jumat, 08.00 – 15.00 WIB" },
  { icon: Phone, label: "Telepon", value: "(0729) 000000" },
  { icon: Mail, label: "Email", value: "bo.pringsewu@bri.co.id" },
];

function Profil() {
  const ukers = useQuery({
    queryKey: ["ukers-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ukers")
        .select("id, kode_uker, nama_uker, tipe, alamat, pic_it, status_aktif")
        .order("kode_uker");
      return sortByUker(
        data ?? [],
        (u) => u.nama_uker,
        (u) => u.tipe,
      );
    },
  });

  return (
    <PublicLayout>
      <h1 className="text-3xl font-bold">
        Profil <span className="gradient-text">Kantor</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        BRI Branch Office Pringsewu membawahi kantor cabang pembantu dan unit yang tersebar di
        wilayah Kabupaten Pringsewu, Lampung.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {info.map((i) => (
          <div key={i.label} className="glass-card flex items-start gap-4 p-5">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ backgroundImage: "var(--gradient-stat)" }}
            >
              <i.icon className="size-4 text-primary-foreground" />
            </span>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{i.label}</p>
              <p className="mt-1 text-sm">{i.value}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-4 flex items-center gap-2 text-lg font-semibold">
        <Building2 className="size-5 text-accent" /> Daftar Unit Kerja
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(ukers.data ?? []).map((u) => (
          <div key={u.id} className="glass-card p-5">
            <p className="text-xs text-accent">{u.kode_uker}</p>
            <h3 className="mt-1 font-semibold">{u.nama_uker}</h3>
            <p className="text-xs text-muted-foreground">{u.tipe}</p>
            <p className="mt-2 text-sm text-muted-foreground">{u.alamat}</p>
          </div>
        ))}
      </div>
    </PublicLayout>
  );
}