import type { ImageFocus, ImageFocusMap } from "@/lib/image-focus.functions";

const CACHE_TABLE = "image_focus";

type FocusRow = { image_key: string; focus_x: number; focus_y: number; has_face: boolean };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Baca cache titik fokus; aman bila tabel belum dibuat. */
export async function readFocusCache(keys: string[]): Promise<ImageFocusMap> {
  if (!keys.length) return {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data, error } = await db
      .from(CACHE_TABLE)
      .select("image_key,focus_x,focus_y,has_face")
      .in("image_key", keys);
    if (error) return {};
    const map: ImageFocusMap = {};
    for (const row of (data ?? []) as FocusRow[]) {
      map[row.image_key] = {
        x: clamp01(Number(row.focus_x)),
        y: clamp01(Number(row.focus_y)),
        face: Boolean(row.has_face),
      };
    }
    return map;
  } catch {
    return {};
  }
}

/** Simpan hasil deteksi supaya gambar yang sama tidak dianalisis ulang. */
export async function writeFocusCache(key: string, focus: ImageFocus): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    await db.from(CACHE_TABLE).upsert(
      {
        image_key: key,
        focus_x: focus.x,
        focus_y: focus.y,
        has_face: focus.face,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "image_key" },
    );
  } catch {
    /* cache opsional */
  }
}

/** Ambil gambar lalu ubah jadi data URL base64 (model tidak bisa fetch Drive). */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length || buf.length > 6_000_000) return null;
    let binary = "";
    for (let i = 0; i < buf.length; i += 8192) {
      binary += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

const PROMPT =
  "Analisis foto ini. Jika ada manusia, tentukan titik tengah wajah (kepala) orang " +
  "yang paling menonjol dalam koordinat ternormalisasi 0..1 (x dari kiri, y dari atas). " +
  "Jika ada beberapa orang, gunakan titik tengah dari semua wajah. " +
  'Balas HANYA JSON: {"face": true, "x": 0.5, "y": 0.28} atau {"face": false}.';

function parseFocus(text: string): ImageFocus | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { face?: unknown; x?: unknown; y?: unknown };
    if (parsed.face !== true) return { x: 0.5, y: 0.5, face: false };
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0.5, y: 0.5, face: false };
    return { x: clamp01(x), y: clamp01(y), face: true };
  } catch {
    return null;
  }
}

/** Deteksi posisi wajah lewat Lovable AI Gateway (vision). */
export async function detectFaceFocus(url: string): Promise<ImageFocus | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const dataUrl = await fetchAsDataUrl(url);
  if (!dataUrl) return null;

  const body = JSON.stringify({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  // 429/5xx bersifat sementara: coba ulang terbatas dengan jeda.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return parseFocus(json.choices?.[0]?.message?.content ?? "");
      }
      const retryable = res.status === 429 || res.status >= 500;
      const detail = await res.text().catch(() => "");
      console.error(`image-focus gateway ${res.status}: ${detail}`);
      if (!retryable || attempt === 2) return null;
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1200 * 2 ** attempt + Math.random() * 400;
      await new Promise((r) => setTimeout(r, Math.min(8000, waitMs)));
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return null;
}

