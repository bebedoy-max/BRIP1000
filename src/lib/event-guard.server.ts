// Cek peran pengelola event (event_admin / it_admin / superadmin).
export async function assertEventAdmin(supabase: unknown, userId: string) {
  const db = supabase as { from: (t: string) => any };
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const allowed = ["event_admin", "it_admin", "superadmin"];
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error("Forbidden: hanya admin event yang boleh mengubah data event.");
  }
}
