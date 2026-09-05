import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiProvider } from "@/lib/ai-brain.types";

export const listAiBrains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertSuperadmin, listBrains } = await import("@/lib/ai-brain.server");
    await assertSuperadmin(context.userId);
    return { brains: await listBrains() };
  });

export const saveAiBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      nama: string;
      provider: AiProvider;
      model: string;
      base_url?: string | null;
      api_key?: string | null;
      aktif: boolean;
      is_default: boolean;
    }) => {
      if (!data.nama?.trim()) throw new Error("Nama wajib diisi.");
      if (!data.model?.trim()) throw new Error("Model wajib diisi.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertSuperadmin, saveBrain } = await import("@/lib/ai-brain.server");
    await assertSuperadmin(context.userId);
    return saveBrain(data);
  });

export const deleteAiBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertSuperadmin, deleteBrain } = await import("@/lib/ai-brain.server");
    await assertSuperadmin(context.userId);
    return deleteBrain(data.id);
  });

export const testAiBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertSuperadmin, callAi } = await import("@/lib/ai-brain.server");
    await assertSuperadmin(context.userId);
    const text = await callAi({
      brainId: data.id,
      system: "Jawab singkat dalam bahasa Indonesia.",
      prompt: "Balas dengan satu kalimat bahwa koneksi AI berhasil.",
    });
    return { text };
  });

export const generateTutorialTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      brainId?: string;
      topicKey: string;
      topicLabel: string;
      topicGroup: string;
      konteks?: string;
    }) => {
      if (!data.topicKey) throw new Error("Topik tidak valid.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertSuperadmin, generateTutorial } = await import("@/lib/ai-brain.server");
    await assertSuperadmin(context.userId);
    return generateTutorial(data);
  });
