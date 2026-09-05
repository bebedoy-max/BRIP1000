// Middleware klien: melampirkan token Supabase pada setiap panggilan server function.
import { createMiddleware } from '@tanstack/react-start'
import { supabase } from '@/lib/supabase'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    let token: string | undefined
    try {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token
    } catch {
      // Tanpa sesi (pengunjung umum) panggilan publik tetap harus jalan.
      token = undefined
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
