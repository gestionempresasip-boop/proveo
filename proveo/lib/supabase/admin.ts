import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente con la service role key: solo para usar en server actions de
// administración (gestión de PINs/usuarios). Nunca exponer al cliente.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
