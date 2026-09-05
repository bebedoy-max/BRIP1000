import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Pilihan aspek rasio standar untuk crop foto nominasi. */
const RATIOS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:6", value: 4 / 6 },
  { label: "16:9", value: 16 / 9 },
];

const BOX = 380;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Props = {
  open: boolean;
  src: string | null;
  onOpenChange: (v: boolean) => void;
  onDone: (dataUrl: string) => void;
};

/** Dialog crop: geser (drag), zoom (slider / scroll), dan pilih aspek rasio. */
export function PhotoCropDialog({ open, src, onOpenChange, onDone }: Props) {
  const [ratio, setRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const offRef = useRef(off);
  zoomRef.current = zoom;
  offRef.current = off;

  // Ukuran area crop.
  const viewW = ratio >= 1 ? BOX : BOX * ratio;
  const viewH = ratio >= 1 ? BOX / ratio : BOX;

  // Skala minimum agar gambar selalu menutupi area crop.
  const base = img ? Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dispW = img ? img.naturalWidth * scale : 0;
  const dispH = img ? img.naturalHeight * scale : 0;

  const limit = useCallback(
    (o: { x: number; y: number }, w: number, h: number) => ({
      x: w <= viewW ? (viewW - w) / 2 : clamp(o.x, viewW - w, 0),
      y: h <= viewH ? (viewH - h) / 2 : clamp(o.y, viewH - h, 0),
    }),
    [viewW, viewH],
  );

  // Muat gambar setiap kali sumber berubah.
  useEffect(() => {
    if (!open || !src) return;
    let alive = true;
    setImg(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    zoomRef.current = 1;
    offRef.current = { x: 0, y: 0 };
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      if (alive) setImg(el);
    };
    el.src = src;
    return () => {
      alive = false;
    };
  }, [open, src]);

  // Posisi awal: gambar berada di tengah area crop.
  useEffect(() => {
    if (!img) return;
    const b = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
    const centered = {
      x: (viewW - img.naturalWidth * b) / 2,
      y: (viewH - img.naturalHeight * b) / 2,
    };
    zoomRef.current = 1;
    offRef.current = centered;
    setZoom(1);
    setOff(centered);
  }, [img, viewW, viewH]);

  /** Ubah zoom sambil menjaga titik jangkar (default: tengah area) tetap diam. */
  const zoomAt = useCallback(
    (next: number, ax: number, ay: number) => {
      if (!img) return;
      const previousZoom = zoomRef.current;
      const previousOffset = offRef.current;
      const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
      const k = z / previousZoom;
      const w = img.naturalWidth * base * z;
      const h = img.naturalHeight * base * z;
      const nextOffset = limit(
        {
          x: ax - (ax - previousOffset.x) * k,
          y: ay - (ay - previousOffset.y) * k,
        },
        w,
        h,
      );
      zoomRef.current = z;
      offRef.current = nextOffset;
      setZoom(z);
      setOff(nextOffset);
    },
    [img, base, limit],
  );

  // Zoom lewat scroll / pinch trackpad (listener non-passive agar preventDefault jalan).
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      zoomAtRef.current(
        zoomRef.current * Math.exp(-dy * 0.0018),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, img, ratio]);

  const apply = () => {
    if (!img) return;
    const outW = 900;
    const outH = Math.round(outW * (viewH / viewW));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    const sx = -off.x / scale;
    const sy = -off.y / scale;
    const sw = viewW / scale;
    const sh = viewH / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    onDone(canvas.toDataURL("image/jpeg", 0.9));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Sesuaikan Foto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RATIOS.map((r) => (
              <Button
                key={r.label}
                type="button"
                size="sm"
                variant={ratio === r.value ? "default" : "outline"}
                onClick={() => setRatio(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-center text-xs font-medium text-muted-foreground">Area hasil crop</div>
            <div className="flex min-h-[380px] items-center justify-center overflow-hidden rounded-md bg-muted/40 p-3">
              <div
                ref={boxRef}
                data-testid="crop-box"
                className="relative shrink-0 cursor-grab overflow-hidden border-2 border-primary bg-muted shadow-lg active:cursor-grabbing"
                style={{ width: viewW, height: viewH, touchAction: "none" }}
              onPointerDown={(e) => {
                if (!img) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const nextOffset = limit(
                  { x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) },
                  dispW,
                  dispH,
                );
                offRef.current = nextOffset;
                setOff(nextOffset);
              }}
              onPointerUp={(e) => {
                drag.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              >
                {img ? (
                  <img
                    src={img.src}
                    alt="Foto yang akan dipotong"
                    draggable={false}
                    className="pointer-events-none absolute select-none"
                    style={{
                      width: dispW,
                      height: dispH,
                      maxWidth: "none",
                      maxHeight: "none",
                      left: off.x,
                      top: off.y,
                    }}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">
                    Memuat foto...
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span key={index} className="border border-primary-foreground/50" />
                  ))}
                </div>
                <span className="pointer-events-none absolute left-0 top-0 size-5 border-l-4 border-t-4 border-primary-foreground" />
                <span className="pointer-events-none absolute right-0 top-0 size-5 border-r-4 border-t-4 border-primary-foreground" />
                <span className="pointer-events-none absolute bottom-0 left-0 size-5 border-b-4 border-l-4 border-primary-foreground" />
                <span className="pointer-events-none absolute bottom-0 right-0 size-5 border-b-4 border-r-4 border-primary-foreground" />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Zoom ({zoom.toFixed(1)}x)</Label>
            <input
              type="range"
              data-testid="crop-zoom"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!img}
              className="w-full accent-primary"
              onChange={(e) => zoomAt(Number(e.target.value), viewW / 2, viewH / 2)}
            />
            <p className="text-[11px] text-muted-foreground">
              Geser gambar untuk mengatur posisi, scroll di area foto untuk zoom.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={apply} disabled={!img}>
            Gunakan Foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
