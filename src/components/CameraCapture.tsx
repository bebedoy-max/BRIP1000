import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pengambilan foto langsung lewat kamera perangkat. */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("Kamera tidak dapat diakses. Gunakan opsi unggah foto.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stop();
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="grid gap-2">
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          className="max-h-64 w-full rounded-xl bg-black object-cover"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={snap} disabled={!!error}>
          <Camera className="size-4" /> Ambil Foto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          disabled={!!error}
        >
          <RefreshCw className="size-4" /> Ganti Kamera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            stop();
            onClose();
          }}
        >
          <X className="size-4" /> Tutup
        </Button>
      </div>
    </div>
  );
}
