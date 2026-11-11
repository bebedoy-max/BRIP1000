// Pelindung SSRF: fetch dari server hanya ke host publik (http/https), termasuk tiap redirect.

const BLOCKED_HOSTS = /(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet)$/i;

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return isPrivateIPv4(v.slice(7));
  return /^(fc|fd|fe[89ab])/.test(v) || v.startsWith("ff");
}

export function isPrivateIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

/** Lempar error bila URL bukan http(s) publik. Literal IP selalu ditolak. */
export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL tidak valid.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("Protokol URL tidak diizinkan.");
  if (u.username || u.password) throw new Error("URL tidak boleh memuat kredensial.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Port URL tidak diizinkan.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_HOSTS.test(host)) throw new Error("Host URL tidak diizinkan.");
  if (/^[\d.]+$/.test(host) || host.includes(":"))
    throw new Error("Alamat IP langsung tidak diizinkan.");
  if (!host.includes(".")) throw new Error("Host URL tidak diizinkan.");
  return u;
}

async function resolvesToPrivate(host: string): Promise<boolean> {
  try {
    const { lookup } = await import("node:dns/promises");
    const res = await lookup(host, { all: true });
    return res.some((r) => isPrivateIp(r.address));
  } catch {
    return false; // runtime tanpa DNS node: cek literal di atas tetap berlaku
  }
}

/** fetch yang memvalidasi URL awal dan setiap redirect (maks. 4 lompatan). */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  maxRedirects = 4,
): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = assertPublicHttpUrl(current);
    if (await resolvesToPrivate(u.hostname)) throw new Error("Host URL tidak diizinkan.");
    const res = await fetch(u.toString(), { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, u).toString();
      continue;
    }
    return res;
  }
  throw new Error("Terlalu banyak pengalihan.");
}
