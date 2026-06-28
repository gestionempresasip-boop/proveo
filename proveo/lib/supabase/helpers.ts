import { cache } from 'react'
import { createClient } from './server'
import { redirect } from 'next/navigation'
import type { ProfileWithOrg } from '@/types/database'

/**
 * Obtiene el perfil del usuario autenticado con su organización.
 * Redirige a /login si no hay sesión o no existe perfil.
 *
 * Envuelto en cache() de React: el layout del dashboard y cada page.tsx
 * llaman a esta función por separado, pero dentro de la misma petición
 * (mismo render del servidor) React reutiliza el resultado en vez de
 * repetir las consultas a Supabase.
 *
 * Usa getSession() (lee el JWT de la cookie, sin red) en vez de getUser()
 * (que siempre llama a los servidores de Supabase Auth): el middleware
 * (proxy.ts) ya validó la sesión con getUser() para esta misma petición
 * y ya redirigió a /login si no era válida. Repetir esa llamada de red
 * aquí solo añade latencia — decisión consciente, aprobada por el
 * usuario: una sesión revocada manualmente deja de funcionar al expirar
 * el token, no al instante, pero el middleware sigue bloqueando a
 * cualquiera sin sesión en absoluto.
 */
export const getAuthProfile = cache(async function getAuthProfile(): Promise<ProfileWithOrg> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!data) {
    // Sign out to clear the session cookie and avoid a redirect loop
    await supabase.auth.signOut()
    redirect('/login')
  }
  return data as ProfileWithOrg
})
