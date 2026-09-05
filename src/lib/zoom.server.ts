// Helper server-only untuk integrasi Zoom Meeting (tidak boleh diimpor dari browser).

export type ZoomAccount = {
  id: string;
  label: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  refresh_token: string | null;
  account_email: string | null;
  is_active: boolean;
};

export const ZOOM_SCOPES = "meeting:write meeting:read user:read";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

/** Hanya admin IT / superadmin yang boleh mengelola Zoom. */
export async function assertAdmin(supabase: unknown, userId: string) {
  const db = supabase as { from: (t: string) => any };
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("it_admin") && !roles.includes("superadmin"))
    throw new Error("Forbidden: hanya admin yang boleh mengatur Zoom Meeting.");
}

export async function getAccountRow(): Promise<ZoomAccount | null> {
  const db = await admin();
  const { data, error } = await db
    .from("zoom_accounts")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ZoomAccount) ?? null;
}

export async function saveAccount(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const db = await admin();
  const existing = await getAccountRow();
  const payload = {
    client_id: input.clientId.trim(),
    client_secret: input.clientSecret.trim(),
    redirect_uri: input.redirectUri.trim(),
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const patch = payload.client_secret ? payload : { ...payload, client_secret: existing.client_secret };
    const { error } = await db.from("zoom_accounts").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id as string;
  }
  const { data, error } = await db.from("zoom_accounts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export function authorizeUrl(acc: ZoomAccount) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: acc.client_id,
    redirect_uri: acc.redirect_uri,
    state: acc.id,
  });
  return `https://zoom.us/oauth/authorize?${p.toString()}`;
}

function basic(acc: ZoomAccount) {
  return btoa(`${acc.client_id}:${acc.client_secret}`);
}

async function tokenRequest(acc: ZoomAccount, body: URLSearchParams) {
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic(acc)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zoom token error [${res.status}]: ${text}`);
  return JSON.parse(text) as { access_token: string; refresh_token?: string };
}

/** Tukar authorization code jadi refresh token (dipakai route callback). */
export async function exchangeCode(accountId: string, code: string, redirectUri: string) {
  const db = await admin();
  const { data, error } = await db.from("zoom_accounts").select("*").eq("id", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Akun Zoom tidak ditemukan.");
  const acc = data as ZoomAccount;

  const tok = await tokenRequest(
    acc,
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
  if (!tok.refresh_token) throw new Error("Zoom tidak mengirim refresh token.");

  let email: string | null = null;
  const me = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (me.ok) email = ((await me.json()) as { email?: string }).email ?? null;

  await db
    .from("zoom_accounts")
    .update({
      refresh_token: tok.refresh_token,
      account_email: email,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", acc.id);
  return email;
}

/** Access token baru dari refresh token (Zoom merotasi refresh token setiap kali). */
export async function accessToken(): Promise<{ token: string; acc: ZoomAccount }> {
  const acc = await getAccountRow();
  if (!acc) throw new Error("Kredensial Zoom belum diisi.");
  if (!acc.refresh_token) throw new Error("Akun Zoom belum terhubung. Klik \"Hubungkan Zoom\".");
  const tok = await tokenRequest(
    acc,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: acc.refresh_token }),
  );
  if (tok.refresh_token) {
    const db = await admin();
    await db
      .from("zoom_accounts")
      .update({ refresh_token: tok.refresh_token, updated_at: new Date().toISOString() })
      .eq("id", acc.id);
  }
  return { token: tok.access_token, acc };
}

async function zoomApi(path: string, init: RequestInit = {}) {
  const { token } = await accessToken();
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zoom API error [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : {};
}

export type MeetingInput = {
  topic: string;
  agenda: string;
  startTime: string; // "yyyy-MM-ddTHH:mm" waktu lokal
  duration: number;
  timezone: string;
  password: string;
};

/** Buat meeting di Zoom lalu simpan jadwalnya. */
export async function createMeeting(input: MeetingInput, userId: string) {
  const created = (await zoomApi("/users/me/meetings", {
    method: "POST",
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: `${input.startTime.slice(0, 16)}:00`,
      duration: input.duration,
      timezone: input.timezone,
      agenda: input.agenda || undefined,
      password: input.password || undefined,
      settings: { join_before_host: true, waiting_room: false, mute_upon_entry: true },
    }),
  })) as {
    id?: number | string;
    join_url?: string;
    start_url?: string;
    password?: string;
    host_email?: string;
    start_time?: string;
  };

  const db = await admin();
  const { error } = await db.from("zoom_meetings").insert({
    zoom_meeting_id: created.id ? String(created.id) : null,
    topic: input.topic,
    agenda: input.agenda || null,
    start_time: created.start_time ?? new Date(input.startTime).toISOString(),
    duration: input.duration,
    timezone: input.timezone,
    join_url: created.join_url ?? null,
    start_url: created.start_url ?? null,
    password: created.password ?? input.password ?? null,
    host_email: created.host_email ?? null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return { joinUrl: created.join_url ?? null };
}

export async function listMeetings() {
  const db = await admin();
  const { data, error } = await db
    .from("zoom_meetings")
    .select("*")
    .order("start_time", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ZoomMeetingRow[];
}

export async function deleteMeeting(id: string) {
  const db = await admin();
  const { data, error } = await db.from("zoom_meetings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as ZoomMeetingRow | null;
  if (row?.zoom_meeting_id) {
    try {
      await zoomApi(`/meetings/${row.zoom_meeting_id}?schedule_for_reminder=false`, {
        method: "DELETE",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 404 / kode 3001 = meeting memang sudah tidak ada di Zoom → lanjut hapus lokal.
      const alreadyGone = msg.includes("[404]") || msg.includes('"code":3001');
      if (!alreadyGone) {
        console.error("Zoom delete failed:", msg);
        throw new Error(`Gagal menghapus meeting di Zoom: ${msg}`);
      }
    }
  }
  const del = await db.from("zoom_meetings").delete().eq("id", id);
  if (del.error) throw new Error(del.error.message);
}


export type ZoomMeetingRow = {
  id: string;
  zoom_meeting_id: string | null;
  topic: string;
  agenda: string | null;
  start_time: string;
  duration: number;
  timezone: string;
  join_url: string | null;
  start_url: string | null;
  password: string | null;
  host_email: string | null;
};
