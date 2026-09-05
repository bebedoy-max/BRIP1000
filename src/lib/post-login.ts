/** Penanda bahwa pengguna baru saja melakukan proses login. */
export const POST_LOGIN_KEY = "post_login_redirect";

/** Tujuan default setelah login sukses. */
export const POST_LOGIN_TARGET = "/admin";

export function markPostLogin() {
  if (typeof window !== "undefined") localStorage.setItem(POST_LOGIN_KEY, "1");
}

export function clearPostLogin() {
  if (typeof window !== "undefined") localStorage.removeItem(POST_LOGIN_KEY);
}

export function hasPostLogin() {
  return typeof window !== "undefined" && localStorage.getItem(POST_LOGIN_KEY) === "1";
}
