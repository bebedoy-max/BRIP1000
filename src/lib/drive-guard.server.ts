// Cek peran admin untuk server function Google Drive.
export async function assertAdmin(supabase: unknown, userId: string) {
  const db = supabase as { from: (t: string) => any };
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("it_admin") && !roles.includes("superadmin")) {
    throw new Error("Forbidden: hanya admin yang boleh mengatur Google Drive.");
  }
}
