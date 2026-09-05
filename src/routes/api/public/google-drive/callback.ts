import { createFileRoute } from "@tanstack/react-router";

function page(message: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Drive</title><body style="font-family:system-ui;background:#0b1020;color:#e7ecff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${message}</h2><p>Anda bisa menutup tab ini.</p></div><script>setTimeout(()=>window.close(),1500)</script>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/google-drive/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return page("Kode otorisasi tidak lengkap.");

        try {
          const { getAccount } = await import("@/lib/drive.server");
          const acc = await getAccount(state);
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: acc.client_id,
              client_secret: acc.client_secret,
              redirect_uri: `${url.origin}/api/public/google-drive/callback`,
              grant_type: "authorization_code",
            }),
          });
          const body = await tokenRes.text();
          if (!tokenRes.ok) return page(`Gagal menghubungkan Google Drive (${tokenRes.status}).`);
          const tok = JSON.parse(body) as { refresh_token?: string; access_token?: string };
          if (!tok.refresh_token) return page("Google tidak mengirim refresh token. Coba hubungkan ulang.");

          let email: string | null = null;
          if (tok.access_token) {
            const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tok.access_token}` },
            });
            if (me.ok) email = ((await me.json()) as { email?: string }).email ?? null;
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as { from: (t: string) => any };
          await db
            .from("drive_accounts")
            .update({
              refresh_token: tok.refresh_token,
              account_email: email,
              updated_at: new Date().toISOString(),
            })
            .eq("id", acc.id);

          return page("Google Drive berhasil terhubung.");
        } catch (e) {
          console.error(e);
          return page("Terjadi kesalahan saat menghubungkan Google Drive.");
        }
      },
    },
  },
});
