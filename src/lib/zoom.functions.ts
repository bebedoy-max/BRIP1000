import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getZoomStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, getAccountRow, authorizeUrl, listMeetings } = await import("@/lib/zoom.server");
    await assertAdmin(context.supabase, context.userId);
    const acc = await getAccountRow();
    return {
      configured: !!acc,
      connected: !!acc?.refresh_token,
      clientId: acc?.client_id ?? "",
      redirectUri: acc?.redirect_uri ?? "https://bripringsewu.web.id/api/zoom/callback",
      accountEmail: acc?.account_email ?? null,
      authorizeUrl: acc ? authorizeUrl(acc) : null,
      meetings: acc ? await listMeetings() : [],
    };
  });

export const saveZoomCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string; clientSecret: string; redirectUri: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveAccount } = await import("@/lib/zoom.server");
    await assertAdmin(context.supabase, context.userId);
    if (!data.clientId.trim()) throw new Error("Client ID wajib diisi.");
    await saveAccount(data);
    return { ok: true };
  });

export const createZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      topic: string;
      agenda: string;
      startTime: string;
      duration: number;
      timezone: string;
      password: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, createMeeting } = await import("@/lib/zoom.server");
    await assertAdmin(context.supabase, context.userId);
    if (!data.topic.trim()) throw new Error("Topik meeting wajib diisi.");
    if (!data.startTime) throw new Error("Waktu mulai wajib diisi.");
    return createMeeting(data, context.userId);
  });

export const deleteZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteMeeting } = await import("@/lib/zoom.server");
    await assertAdmin(context.supabase, context.userId);
    await deleteMeeting(data.id);
    return { ok: true };
  });
