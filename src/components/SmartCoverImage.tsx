import type { ImageFocus } from "@/lib/image-focus.functions";

type Props = {
  src: string;
  alt: string;
  className?: string | undefined;
  loading?: "lazy" | "eager";
  /** Titik fokus hasil deteksi wajah di server (0..1). */
  focus?: ImageFocus | undefined;
  onError?: (() => void) | undefined;
};

const posOf = (f: ImageFocus) => `${Math.round(f.x * 100)}% ${Math.round(f.y * 100)}%`;

/**
 * Gambar cover yang fokus ke wajah.
 * - Bila server mendeteksi wajah, posisi crop dipakai langsung sejak render
 *   pertama dan tidak pernah berubah setelah gambar tampil (tanpa pergeseran).
 * - Bila tidak ada wajah terdeteksi, gambar dibiarkan apa adanya (crop tengah).
 */
export function SmartCoverImage({ src, alt, className, loading = "lazy", focus, onError }: Props) {
  const pos = focus?.face ? posOf(focus) : "50% 50%";

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onError}
      style={{ objectPosition: pos }}
    />
  );
}
