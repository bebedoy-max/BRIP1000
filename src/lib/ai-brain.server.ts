/** Helper server-only untuk AI Brain (koneksi AI eksternal). */

type Db = { from: (t: string) => any };
type Row = Record<string, any>;

export type AiProvider = "gemini" | "openai" | "anthropic" | "custom";

export type AiBrain = {
  id: string;
  nama: string;
  provider: AiProvider;
  model: string;
  base_url: string | null;
  aktif: boolean;
  is_default: boolean;
  key_preview: string;
  updated_at?: string | null;
};

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export async function assertSuperadmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("superadmin")) throw new Error("Hanya Super Admin yang boleh mengakses AI Brain.");
}

function mask(key: string) {
  const k = String(key ?? "");
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

function toBrain(row: Row): AiBrain {
  return {
    id: String(row["id"]),
    nama: String(row["nama"] ?? ""),
    provider: (row["provider"] ?? "gemini") as AiProvider,
    model: String(row["model"] ?? ""),
    base_url: row["base_url"] ?? null,
    aktif: !!row["aktif"],
    is_default: !!row["is_default"],
    key_preview: mask(row["api_key"]),
    updated_at: row["updated_at"] ?? null,
  };
}

export async function listBrains(): Promise<AiBrain[]> {
  const db = await admin();
  const { data, error } = await db.from("ai_brains").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBrain);
}

export type BrainInput = {
  id?: string;
  nama: string;
  provider: AiProvider;
  model: string;
  base_url?: string | null;
  api_key?: string | null;
  aktif: boolean;
  is_default: boolean;
};

export async function saveBrain(input: BrainInput) {
  const db = await admin();
  const patch: Row = {
    nama: input.nama.trim(),
    provider: input.provider,
    model: input.model.trim(),
    base_url: input.base_url?.trim() || null,
    aktif: input.aktif,
    is_default: input.is_default,
  };
  if (input.api_key && input.api_key.trim()) patch["api_key"] = input.api_key.trim();

  let id = input.id;
  if (id) {
    const { error } = await db.from("ai_brains").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    if (!patch["api_key"]) throw new Error("API key wajib diisi.");
    const { data, error } = await db.from("ai_brains").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    id = String(data["id"]);
  }
  if (input.is_default && id) {
    await db.from("ai_brains").update({ is_default: false }).neq("id", id);
  }
  return { id };
}

export async function deleteBrain(id: string) {
  const db = await admin();
  const { error } = await db.from("ai_brains").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function pickBrain(id?: string) {
  const db = await admin();
  let q = db.from("ai_brains").select("*").eq("aktif", true);
  if (id) q = q.eq("id", id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (!rows.length) throw new Error("Belum ada AI Brain aktif. Tambahkan di menu Setting → AI Brain.");
  return rows.find((r) => r["is_default"]) ?? rows[0]!;
}

/** Panggil model AI dan kembalikan teks jawaban. */
export async function callAi(opts: { brainId?: string | undefined; system: string; prompt: string }) {
  const brain = await pickBrain(opts.brainId);
  const provider = String(brain["provider"] ?? "gemini") as AiProvider;
  const model = String(brain["model"] ?? "");
  const key = String(brain["api_key"] ?? "");
  const base = String(brain["base_url"] ?? "").replace(/\/$/, "");

  if (provider === "gemini") {
    const url = `${base || "https://generativelanguage.googleapis.com/v1beta"}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json?.error?.message ?? `Gemini error ${res.status}`);
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: any) => p?.text ?? "").join("").trim();
  }

  if (provider === "anthropic") {
    const res = await fetch(`${base || "https://api.anthropic.com/v1"}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json?.error?.message ?? `Anthropic error ${res.status}`);
    return (json?.content ?? []).map((c: any) => c?.text ?? "").join("").trim();
  }

  // openai / custom (OpenAI-compatible)
  const res = await fetch(`${base || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI error ${res.status}`);
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

const SYSTEM_PROMPT = `Kamu adalah penulis dokumentasi produk berbahasa Indonesia untuk aplikasi internal
"Panel BRI BO Pringsewu" (web app admin: database unit kerja/pekerja/mesin ATM-CRM-EDC-QRIS, project & event IT,
SuperIT Apps (absensi wajah, voting, nominasi, undian), Apps Ext, Buku Harian IT, Tiket IT, Google Drive,
serta menu Setting untuk akses halaman, user, carousel, papan informasi, dan lainnya).
Tulis panduan tata cara penggunaan yang praktis, ringkas, dan langsung bisa diikuti.
Format keluaran WAJIB teks biasa dengan aturan:
"## Judul bagian" untuk sub-judul, "- " untuk poin, "1. " untuk langkah berurutan.
Jangan gunakan markdown lain (tanpa tabel, tanpa **tebal**, tanpa blok kode).`;

/** Buat isi panduan untuk satu topik lalu simpan ke tabel tutorials. */
export async function generateTutorial(opts: {
  brainId?: string | undefined;
  topicKey: string;
  topicLabel: string;
  topicGroup: string;
  konteks?: string;
}) {
  const prompt = `Tulis panduan penggunaan untuk topik "${opts.topicLabel}" (kelompok: ${opts.topicGroup}, kode menu: ${opts.topicKey}).
${opts.konteks ? `Konteks tambahan tentang aplikasi:\n${opts.konteks}\n` : ""}
Sertakan: ringkasan singkat fungsi menu, langkah-langkah penggunaan (tambah/ubah/hapus data bila relevan),
tips, dan catatan hak akses (Super Admin, Admin, Manajemen, Pekerja).
Awali jawaban dengan satu baris "RINGKASAN: <satu kalimat>" lalu baris kosong, kemudian isi panduannya.`;

  const text = await callAi({ brainId: opts.brainId, system: SYSTEM_PROMPT, prompt });
  let ringkasan = "";
  let konten = text;
  const m = text.match(/^RINGKASAN:\s*(.+)$/im);
  if (m) {
    ringkasan = m[1]!.trim();
    konten = text.replace(m[0], "").trim();
  }

  const db = await admin();
  const { error } = await db.from("tutorials").upsert(
    {
      topic_key: opts.topicKey,
      judul: opts.topicLabel,
      ringkasan: ringkasan || null,
      konten,
    },
    { onConflict: "topic_key" },
  );
  if (error) throw new Error(error.message);
  return { topicKey: opts.topicKey, ringkasan, konten };
}
