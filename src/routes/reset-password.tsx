import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Ulang Kata Sandi — Panel BRI BO Pringsewu" },
      { name: "description", content: "Buat kata sandi baru untuk akun panel internal Anda." },
      { property: "og:title", content: "Atur Ulang Kata Sandi — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Buat kata sandi baru untuk akun panel internal." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Kata sandi berhasil diperbarui");
    void navigate({ to: "/admin", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <div className="glass-card w-full space-y-4 p-6">
        <h1 className="text-xl font-semibold">Atur Ulang Kata Sandi</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Kata sandi baru</Label>
          <Input
            id="pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Minimal 8 karakter"
          />
        </div>
        <Button className="w-full" disabled={pw.length < 8 || busy} onClick={() => void submit()}>
          Simpan
        </Button>
      </div>
    </main>
  );
}
