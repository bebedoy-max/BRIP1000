// Handler bersama untuk callback OAuth Zoom.

function page(message: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Zoom</title><body style="font-family:system-ui;background:#0b1020;color:#e7ecff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${message}</h2><p>Anda bisa menutup tab ini.</p></div><script>setTimeout(()=>window.close(),1500)</script>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function handleZoomCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return page(`Zoom menolak otorisasi: ${err}`);
  if (!code) return page("Kode otorisasi Zoom tidak ditemukan.");

  try {
    const { exchangeCode, getAccountRow } = await import("@/lib/zoom.server");
    const acc = await getAccountRow();
    if (!acc) return page("Kredensial Zoom belum diisi di panel.");
    const email = await exchangeCode(state || acc.id, code, acc.redirect_uri);
    return page(`Zoom berhasil terhubung${email ? ` (${email})` : ""}.`);
  } catch (e) {
    console.error(e);
    return page("Gagal menghubungkan Zoom. Periksa Client ID/Secret dan Redirect URL.");
  }
}
