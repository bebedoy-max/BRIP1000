import { useState } from "react";
import { ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PhotoEntity } from "@/lib/drive-entities";
import { PhotoGallery } from "@/components/PhotoGallery";

/** Perangkat seluler (HP/tablet): navigasi langsung dibuka di aplikasi Google Maps. */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform))
  );
}

export function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (value === null || value === undefined) return null;
  const m = String(value)
    .trim()
    .match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Label titik maps yang bisa diklik: membuka pop up peta + foto + street view. */
export function MapsLink({
  value,
  label,
  name,
  photoEntity,
  entityId,
}: {
  value: unknown;
  label?: string;
  /** Nama entitas (uker/atm/crm/dst) untuk label tab foto, mis. "Foto ATM Pringsewu". */
  name?: string | undefined;
  photoEntity?: PhotoEntity | undefined;
  entityId?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"map" | "photo" | "street" | "route">("map");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "loading" | "denied" | "ok">("idle");
  const pos = parseLatLng(value);

  if (!pos) {
    const text = value === null || value === undefined || value === "" ? "—" : String(value);
    return <span>{text}</span>;
  }

  const coord = `${pos.lat},${pos.lng}`;
  const embedMap = `https://maps.google.com/maps?q=${coord}&z=17&hl=id&output=embed`;
  const embedStreet = `https://maps.google.com/maps?q=&layer=c&cbll=${coord}&cbp=11,0,0,0,0&hl=id&output=svembed`;

  const originCoord = origin ? `${origin.lat},${origin.lng}` : "";
  // Rute dari lokasi pengguna ke titik tujuan (tanpa API key).
  const embedRoute = `https://maps.google.com/maps?${
    originCoord ? `saddr=${originCoord}&` : ""
  }daddr=${coord}&dirflg=d&hl=id&output=embed`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&${
    originCoord ? `origin=${originCoord}&` : ""
  }destination=${coord}&travelmode=driving`;
  // Di HP: tautan universal Google Maps membuka aplikasi dan langsung memulai navigasi.
  const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${coord}&travelmode=driving&dir_action=navigate`;

  const src = mode === "street" ? embedStreet : mode === "route" ? embedRoute : embedMap;
  const title =
    mode === "street"
      ? "Google Street View"
      : mode === "route"
        ? "Rute Google Maps"
        : "Google Maps";

  function startNavigation() {
    if (isMobileDevice()) {
      window.open(navigateUrl, "_blank", "noopener");
      return;
    }
    // Komputer: tampilkan rute dari lokasi yang terdeteksi browser.
    setMode("route");
    if (origin || geo === "loading") return;
    if (!navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo("ok");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode("map");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Lihat titik maps ${label ?? coord}`}
      >
        <MapPin className="size-3.5" />
        <span className="tabular-nums">{label ?? `${pos.lat}, ${pos.lng}`}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Titik Maps</DialogTitle>
            <DialogDescription>
              Koordinat {pos.lat}, {pos.lng}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={startNavigation} className="gap-1.5">
              <Navigation className="size-4" /> Mulai Navigasi
            </Button>
            <Button
              size="sm"
              variant={mode === "map" ? "default" : "secondary"}
              onClick={() => setMode("map")}
            >
              Peta
            </Button>
            <Button
              size="sm"
              variant={mode === "photo" ? "default" : "secondary"}
              onClick={() => setMode("photo")}
            >
              Foto
            </Button>
            <Button
              size="sm"
              variant={mode === "street" ? "default" : "secondary"}
              onClick={() => setMode("street")}
            >
              Street View
            </Button>
          </div>

          {mode === "route" ? (
            <p className="text-xs text-muted-foreground">
              {geo === "loading"
                ? "Mendeteksi lokasi Anda… izinkan akses lokasi pada browser."
                : geo === "ok"
                  ? "Rute dari lokasi Anda saat ini ke titik tujuan."
                  : "Lokasi Anda tidak terdeteksi. Izinkan akses lokasi di browser, atau masukkan titik awal di peta."}
            </p>
          ) : null}

          {mode === "photo" ? (
            <div className="rounded-xl border border-border/60 p-3">
              {photoEntity && entityId ? (
                <PhotoGallery
                  entity={photoEntity}
                  entityId={entityId}
                  title={name ? `Foto ${name}` : "Foto lokasi"}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada foto untuk lokasi ini.</p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <iframe
                key={`${mode}-${originCoord}`}
                title={title}
                src={src}
                className="h-[420px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}

          {mode === "route" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {geo === "loading" ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Menunggu izin lokasi…
                </span>
              ) : (
                <span />
              )}
              <Button asChild size="sm" variant="secondary">
                <a href={routeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Buka rute di Google Maps
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
