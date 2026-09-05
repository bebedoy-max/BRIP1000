import { createServerFn } from "@tanstack/react-start";

export type ImageFocus = {
  /** Titik fokus horizontal (0..1) untuk object-position. */
  x: number;
  /** Titik fokus vertikal (0..1). */
  y: number;
  /** True bila fokus berasal dari deteksi wajah. */
  face: boolean;
};

export type ImageFocusMap = Record<string, ImageFocus>;

export type ImageFocusInput = { images: { key: string; url: string }[] };

/**
 * Hitung titik fokus (wajah) untuk gambar carousel di server, lalu cache di
 * tabel `image_focus`. Dipanggil sebelum gambar tampil supaya crop tidak
 * berubah-ubah setelah gambar dirender.
 */
export const getImageFocus = createServerFn({ method: "POST" })
  .inputValidator((input: ImageFocusInput) => {
    const list = Array.isArray(input?.images) ? input.images : [];
    return {
      images: list
        .filter((i) => i && typeof i.key === "string" && typeof i.url === "string")
        .map((i) => ({ key: i.key.slice(0, 200), url: i.url.slice(0, 2000) }))
        .filter((i) => /^https?:\/\//i.test(i.url))
        .slice(0, 40),
    };
  })
  .handler(async ({ data }): Promise<ImageFocusMap> => {
    const { images } = data;
    if (!images.length) return {};

    const { readFocusCache, writeFocusCache } = await import("@/lib/image-focus.server");
    const { detectFaceFocus } = await import("@/lib/image-focus.server");

    const result: ImageFocusMap = {};
    const cached = await readFocusCache(images.map((i) => i.key));
    const pending = images.filter((i) => {
      const hit = cached[i.key];
      if (hit) {
        result[i.key] = hit;
        return false;
      }
      return true;
    });

    // Batasi paralelisme supaya tidak memberatkan gateway.
    const queue = [...pending];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        const focus = await detectFaceFocus(item.url);
        if (!focus) continue;
        result[item.key] = focus;
        await writeFocusCache(item.key, focus);
      }
    });
    await Promise.all(workers);

    return result;
  });
