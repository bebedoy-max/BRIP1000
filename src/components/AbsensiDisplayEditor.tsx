import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  compressImage,
  pickImage,
  themePresets,
  type AbsensiDisplay,
} from "@/lib/absensi-ui";

type ImageKey = "logo" | "logoLeft" | "logoRight" | "background" | "cardBackground";

const imageFields: { key: ImageKey; label: string; max: number; quality: number }[] = [
  { key: "logo", label: "Logo", max: 400, quality: 0.85 },
  { key: "logoLeft", label: "Logo pojok kiri atas", max: 400, quality: 0.85 },
  { key: "logoRight", label: "Logo pojok kanan atas", max: 400, quality: 0.85 },
  { key: "background", label: "Background", max: 1400, quality: 0.75 },
  { key: "cardBackground", label: "Background kolom absen", max: 900, quality: 0.8 },
];

/** Editor tampilan absensi (dipakai di pengaturan event dan default tampilan). */
export function AbsensiDisplayEditor({
  value,
  onChange,
}: {
  value: AbsensiDisplay;
  onChange: (patch: Partial<AbsensiDisplay>) => void;
}) {
  async function uploadImage(f: (typeof imageFields)[number]) {
    const img = await pickImage();
    if (img) onChange({ [f.key]: await compressImage(img, f.max, f.quality) } as Partial<AbsensiDisplay>);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {imageFields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label>{f.label}</Label>
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 text-[10px] text-muted-foreground">
                {value[f.key] ? (
                  <img src={value[f.key] as string} alt={f.label} className="size-full object-cover" />
                ) : (
                  "Kosong"
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="secondary" onClick={() => void uploadImage(f)}>
                  Ganti
                </Button>
                {value[f.key] ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ [f.key]: null } as Partial<AbsensiDisplay>)}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Ukuran logo pojok kiri: {value.logoLeftSize}px</Label>
          <input
            type="range"
            min={8}
            max={320}
            step={4}
            className="w-full"
            value={value.logoLeftSize}
            onChange={(e) => onChange({ logoLeftSize: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Ukuran logo pojok kanan: {value.logoRightSize}px</Label>
          <input
            type="range"
            min={8}
            max={320}
            step={4}
            className="w-full"
            value={value.logoRightSize}
            onChange={(e) => onChange({ logoRightSize: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Posisi vertikal logo kiri: {value.logoLeftTop}px</Label>
          <input
            type="range"
            min={0}
            max={240}
            step={2}
            className="w-full"
            value={value.logoLeftTop}
            onChange={(e) => onChange({ logoLeftTop: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Posisi vertikal logo kanan: {value.logoRightTop}px</Label>
          <input
            type="range"
            min={0}
            max={240}
            step={2}
            className="w-full"
            value={value.logoRightTop}
            onChange={(e) => onChange({ logoRightTop: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tema warna aplikasi</Label>
        <div className="flex flex-wrap gap-2">
          {themePresets.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange({ themeColor: t.key })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                value.themeColor === t.key ? "border-primary" : "border-border/60"
              }`}
            >
              <span className="inline-block size-4 rounded-full" style={{ background: t.accent }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
