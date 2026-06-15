import { createClient } from './server'
import { redirect } from 'next/navigation'
import type { ProfileWithOrg } from '@/types/database'

/**
 * Obtiene el perfil del usuario autenticado con su organización.
 * Redirige a /login si no hay sesión o no existe perfil.
 */
export async function getAuthProfile(): Promise<ProfileWithOrg> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
}
