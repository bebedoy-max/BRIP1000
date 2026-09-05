import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AppRole = "superadmin" | "it_admin" | "event_admin" | "employee";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 30_000,
  });
}

export function useRoles() {
  const { data: session, isLoading } = useSession();
  const q = useQuery({
    queryKey: ["roles", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  return {
    roles,
    session,
    loading: isLoading || q.isLoading,
    isSuperadmin: roles.includes("superadmin"),
    isItAdmin: roles.includes("it_admin") || roles.includes("superadmin"),
    isEventAdmin: roles.includes("event_admin") || roles.includes("superadmin"),
  };
}