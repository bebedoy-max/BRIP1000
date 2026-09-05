import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { qrFrameDataUrl } from "@/assets/qr-frame";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const W = 1842;
const H = 1758;
const NAVY = "#0843b5";

/** Area kotak oranye pada frame, tempat QR ditempel. */
const QR_BOX = { x: 352, y: 268, size: 1150 };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Kecilkan font sampai teks muat di lebar maksimum. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize = 26,
) {
  let size = startSize;
  for (;;) {
    ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) return size;
    size -= 2;
  }
}

/** Pecah teks jadi maksimal 2 baris seimbang bila terlalu panjang untuk satu baris. */
function wrapTwoLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  let best: [string, string] | null = null;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  const [a, b] = best ?? [text, ""];
  void maxWidth;
  return b ? [a, b] : [a];
}


/** Susun QR di dalam frame BRI lengkap dengan nama event, tanggal, dan lokasi. */
async function composeQr(url: string, opts: { eventName?: string | undefined; dateText?: string | undefined; locationText?: string | undefined }) {
  const [frame, qr] = await Promise.all([
    loadImage(qrFrameDataUrl),
    QRCode.toDataURL(url, { width: QR_BOX.size, margin: 0, errorCorrectionLevel: "M" }).then(loadImage),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Latar putih supaya bagian dalam frame tidak transparan saat diunduh.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, QR_BOX.x, QR_BOX.y, QR_BOX.size, QR_BOX.size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(frame, 0, 0, W, H);

  const name = (opts.eventName ?? "").trim().toUpperCase();
  if (name) {
    const MAX_W = 1030;
    ctx.fillStyle = NAVY;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const oneLine = fitFont(ctx, name, MAX_W, 112, 40);
    if (oneLine >= 84) {
      // Judul pendek: satu baris besar.
      ctx.font = `700 ${oneLine}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(name, 104, 112);
    } else {
      // Judul panjang: dua baris seimbang, tetap besar dan bold.
      ctx.font = `700 100px "Helvetica Neue", Arial, sans-serif`;
      const lines = wrapTwoLines(ctx, name, MAX_W);
      if (lines.length === 1) {
        ctx.font = `700 ${oneLine}px "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(name, 104, 112);
      } else {
        const size = Math.min(
          fitFont(ctx, lines[0] ?? "", MAX_W, 104, 40),
          fitFont(ctx, lines[1] ?? "", MAX_W, 104, 40),
        );
        ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
        const lh = size * 1.08;
        ctx.fillText(lines[0] ?? "", 104, 130 - lh / 2);
        ctx.fillText(lines[1] ?? "", 104, 130 + lh / 2);
      }
    }
  }


  const date = (opts.dateText ?? "").trim();
  if (date) {
    const size = fitFont(ctx, date, 780, 62, 30);
    ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(date, 104, 1684);
  }

  const loc = (opts.locationText ?? "").trim();
  if (loc) {
    const size = fitFont(ctx, loc, 780, 62, 30);
    ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(loc, 1770, 1668);
  }

  return canvas.toDataURL("image/png");
}

/** Pop up QR Code sebuah link dalam frame BRI, lengkap dengan tombol unduh PNG. */
export function QrCodeDialog({
  open,
  onOpenChange,
  url,
  title,
  fileName,
  eventName,
  dateText,
  locationText,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  title?: string;
  fileName?: string;
  /** Nama event yang dicetak di kiri atas frame. */
  eventName?: string | undefined;
  /** Tanggal event (sudah diformat) di kiri bawah frame. */
  dateText?: string | undefined;
  /** Lokasi / nama kantor di kanan bawah frame. */
  locationText?: string | undefined;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (!open || !url) return;
    let alive = true;
    setSrc("");
    void composeQr(url, { eventName, dateText, locationText })
      .then((d) => {
        if (alive) setSrc(d);
      })
      .catch(() => {
        if (alive) setSrc("");
      });
    return () => {
      alive = false;
    };
  }, [open, url, eventName, dateText, locationText]);

  function download() {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${(fileName ?? title ?? "qr-code").replace(/[^\w-]+/g, "-")}.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? "QR Code"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-center">
          {src ? (
            <img
              src={src}
              alt="QR Code dengan frame BRI"
              className="mx-auto w-full max-w-[340px] rounded-xl bg-white p-1"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Membuat QR...</p>
          )}
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <Button className="w-full" onClick={download} disabled={!src}>
            <Download className="size-4" /> Unduh QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
