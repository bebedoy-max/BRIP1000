import { useSyncExternalStore } from "react";

/** Status media query yang aman untuk SSR (server = false, lalu menyesuaikan setelah hidrasi). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
