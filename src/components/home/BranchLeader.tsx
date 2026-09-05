import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

type Leader = { id: string; nama: string; jabatan: string | null; foto_url: string | null };

/** Kartu profil Pemimpin Cabang. */
export function BranchLeader() {
  const q = useQuery({
    queryKey: ["branch-leader"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await db
        .from("employees")
        .select("id,nama,jabatan,foto_url")
        .ilike("jabatan", "%pemimpin cabang%")
        .limit(1);
      return ((data ?? []) as Leader[])[0] ?? null;
    },
  });
  const leader = q.data;

  return (
    <div className="glass-card flex h-full flex-col items-center p-5 text-center">
      <p className="self-start text-xs font-semibold tracking-[0.18em] text-accent uppercase">
        Pemimpin Cabang
      </p>
      <div
        className="mt-4 grid size-24 place-items-center overflow-hidden rounded-full border border-border/60"
        style={{ backgroundImage: "var(--gradient-stat)" }}
      >
        {leader?.foto_url ? (
          <img src={leader.foto_url} alt={leader.nama} className="size-full object-cover" />
        ) : (
          <UserRound className="size-10 text-primary-foreground" />
        )}
      </div>
      <h3 className="mt-3 font-semibold">{leader?.nama ?? "Belum diatur"}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {leader?.jabatan ?? "Pemimpin Cabang BRI BO Pringsewu"}
      </p>
    </div>
  );
}
