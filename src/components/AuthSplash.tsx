import { Loader2 } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export function AuthSplash({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 px-6 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-6 text-center">
        <img
          src={logoUrl}
          alt="Logo"
          className="h-20 w-auto animate-pulse object-contain"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {label}
        </div>
      </div>
    </div>
  );
}
