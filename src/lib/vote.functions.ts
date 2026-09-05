import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VoteSettings } from "@/lib/vote-ui";

/* -------------------------------- publik -------------------------------- */

export const getVoteEvent = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { publicEvent } = await import("@/lib/vote.server");
    return publicEvent(data.slug);
  });

export const getVoteStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { publicStatus } = await import("@/lib/vote.server");
    return publicStatus(data.slug);
  });

export const checkVoter = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; pn: string }) => data)
  .handler(async ({ data }) => {
    const { voterStatus } = await import("@/lib/vote.server");
    return voterStatus(data.slug, data.pn);
  });

export const submitVote = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; pn: string; category: string; nominee: string }) => data)
  .handler(async ({ data }) => {
    const { castVote } = await import("@/lib/vote.server");
    return castVote(data.slug, data.pn, data.category, data.nominee);
  });

/* --------------------------------- admin -------------------------------- */

export const listVoteEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listEventsFor } = await import("@/lib/vote.server");
    return listEventsFor(context.userId);
  });

export const getVoteAdminEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const {
      assertEventAdmin,
      getEventById,
      listNominees,
      listEventAdmins,
      voteResults,
      voterStats,
      isPanelAdmin,
    } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.id);
    const [event, nominees, admins, results, stats, panel] = await Promise.all([
      getEventById(data.id),
      listNominees(data.id),
      listEventAdmins(data.id),
      voteResults(data.id),
      voterStats(data.id),
      isPanelAdmin(context.userId),
    ]);
    return { event, nominees, admins, results, stats, panel };
  });

export const saveVoteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Omit<VoteSettings, "id"> & { id?: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertCanCreate, assertEventAdmin, saveEvent } = await import("@/lib/vote.server");
    if (data.id) await assertEventAdmin(context.userId, data.id);
    else await assertCanCreate(context.userId);
    const id = await saveEvent(data, context.userId);
    return { id };
  });

export const deleteVoteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertCanCreate, deleteEvent } = await import("@/lib/vote.server");
    await assertCanCreate(context.userId);
    await deleteEvent(data.id);
    return { ok: true };
  });

export const saveVoteNominee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      eventId: string;
      category: string;
      nama: string;
      jabatan?: string | null;
      uker?: string | null;
      personalNumber?: string | null;
      foto?: string | null;
      sortOrder?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, saveNominee } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    const id = await saveNominee(data);
    return { id };
  });

export const deleteVoteNominee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, deleteNominee } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await deleteNominee(data.eventId, data.id);
    return { ok: true };
  });

export const setVoteHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; hold: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, setHold } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await setHold(data.eventId, data.hold);
    return { ok: true };
  });

export const setVoteClosed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; closed: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, setClosed } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await setClosed(data.eventId, data.closed);
    return { ok: true };
  });

export const resetVoteBallots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, resetVotes } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await resetVotes(data.eventId);
    return { ok: true };
  });

export const addVoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; email: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, addEventAdmin } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await addEventAdmin(data.eventId, data.email);
    return { ok: true };
  });

export const removeVoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, removeEventAdmin } = await import("@/lib/vote.server");
    await assertEventAdmin(context.userId, data.eventId);
    await removeEventAdmin(data.eventId, data.id);
    return { ok: true };
  });

/** Daftar pekerja untuk memilih nominasi dari Data Pekerja. */
export const listVoteEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data } = await db
      .from("employees")
      .select("id,nama,personal_number,jabatan:job_titles(nama_jabatan),uker:ukers(nama_uker)")
      .order("nama", { ascending: true });
    // Foto master wajah pekerja (bila sudah diunggah) supaya bisa dipakai jadi foto nominasi.
    const { data: faces } = await db
      .from("worker_faces")
      .select("worker_id,personal_number,reference_photo_url");
    const byWorker = new Map<string, string>();
    const byPn = new Map<string, string>();
    for (const f of (faces ?? []) as Record<string, any>[]) {
      const url = (f["reference_photo_url"] as string | null) ?? null;
      if (!url) continue;
      if (f["worker_id"]) byWorker.set(String(f["worker_id"]), url);
      if (f["personal_number"]) byPn.set(String(f["personal_number"]), url);
    }
    return (data ?? []).map((r: Record<string, any>) => {
      const pn = (r["personal_number"] as string | null) ?? null;
      return {
        id: String(r["id"]),
        nama: String(r["nama"] ?? ""),
        personalNumber: pn,
        jabatan: (r["jabatan"]?.["nama_jabatan"] as string | null) ?? null,
        uker: (r["uker"]?.["nama_uker"] as string | null) ?? null,
        foto: byWorker.get(String(r["id"])) ?? (pn ? byPn.get(pn) ?? null : null),
      };
    });
  });


/** Dashboard pengumuman pemenang (publik, hanya baca). */
export const getVoteShowcase = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { publicShowcase } = await import("@/lib/vote.server");
    return publicShowcase(data.slug);
  });

/** Semua foto pekerja di database (master wajah + foto event) untuk dipilih admin. */
export const listVoteWorkerPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workerId?: string | undefined; personalNumber?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { workerPhotos } = await import("@/lib/vote.server");
    return workerPhotos(data);
  });

/** Ambil gambar (Drive/URL publik) sebagai data URL agar bisa di-crop tanpa masalah CORS. */
export const fetchVoteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const { imageAsDataUrl } = await import("@/lib/vote.server");
    return { dataUrl: await imageAsDataUrl(data.url) };
  });
