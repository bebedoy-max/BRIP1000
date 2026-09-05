import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/absen/$token")({
  head: () => ({
    meta: [
      { title: "Absensi Kegiatan — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Formulir absensi kegiatan BRI Branch Office Pringsewu. Isi nama dan unit kerja Anda untuk mencatat kehadiran.",
      },
      { property: "og:title", content: "Absensi Kegiatan — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Isi kehadiran kegiatan BRI BO Pringsewu tanpa perlu login.",
      },
    ],
  }),
  component: Absen,
});

const schema = z.object({
  nama_manual: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
  uker_manual: z.string().trim().min(2, "Unit kerja wajib diisi").max(100),
  catatan: z.string().trim().max(500).optional(),
});

function Absen() {
  const { token } = Route.useParams();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ nama_manual: "", uker_manual: "", catatan: "" });
  const [saving, setSaving] = useState(false);

  const event = useQuery({
    queryKey: ["event-token", token],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, nama_event, deskripsi, tanggal_mulai, tanggal_selesai, is_active")
        .eq("qr_token", token)
        .maybeSingle();
      return data;
    },
  });

  async function submit() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    if (!event.data) return;
    setSaving(true);
    const { error } = await supabase.from("attendances").insert({
      event_id: event.data.id,
      nama_manual: parsed.data.nama_manual,
      uker_manual: parsed.data.uker_manual,
      catatan: parsed.data.catatan || null,
    });
    setSaving(false);
    if (error) toast.error("Gagal menyimpan absensi: " + error.message);
    else setDone(true);
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg">
        {event.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat kegiatan…</p>
        ) : !event.data || !event.data.is_active ? (
          <div className="glass-card p-8 text-center">
            <h1 className="text-xl font-semibold">Link absensi tidak berlaku</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Kegiatan tidak ditemukan atau absensi telah ditutup.
            </p>
          </div>
        ) : done ? (
          <div className="glass-card p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-[var(--success)]" />
            <h1 className="mt-4 text-xl font-semibold">Kehadiran tercatat</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Terima kasih, {form.nama_manual}. Absensi Anda untuk “{event.data.nama_event}” sudah
              tersimpan.
            </p>
          </div>
        ) : (
          <div className="glass-card p-8">
            <span
              className="grid size-11 place-items-center rounded-2xl"
              style={{ backgroundImage: "var(--gradient-stat)" }}
            >
              <CalendarCheck className="size-5 text-primary-foreground" />
            </span>
            <h1 className="mt-4 text-2xl font-bold">{event.data.nama_event}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{event.data.deskripsi}</p>
            {event.data.tanggal_mulai ? (
              <p className="mt-1 text-xs text-accent">
                {new Date(event.data.tanggal_mulai).toLocaleString("id-ID", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
            ) : null}

            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input
                  id="nama"
                  maxLength={100}
                  value={form.nama_manual}
                  onChange={(e) => setForm({ ...form, nama_manual: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uker">Unit Kerja</Label>
                <Input
                  id="uker"
                  maxLength={100}
                  value={form.uker_manual}
                  onChange={(e) => setForm({ ...form, uker_manual: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="catatan">Catatan (opsional)</Label>
                <Textarea
                  id="catatan"
                  maxLength={500}
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                />
              </div>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Menyimpan…" : "Kirim Absensi"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}