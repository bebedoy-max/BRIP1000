import { useApplyAppearance } from "@/lib/appearance";

/** Menerapkan tema warna & font pilihan Super Admin ke seluruh aplikasi. */
export function AppearanceProvider() {
  useApplyAppearance();
  return null;
}
