'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Login individual del personal de la nave (cocineros, gestores...). A
// diferencia del login por organización (LoginClient.tsx, un email
// compartido por restaurante), aquí cada persona tiene su propia cuenta.
// Se resuelve todo en el servidor para no exponer el email de nadie al
// navegador antes de autenticarse.

export type NaveStaffMember = { id: string; full_name: string | null; role: string }

// Llamable sin sesión (pantalla de login) — solo expone nombre y rol, nunca
// el email ni el PIN, por eso usa el cliente admin en vez de esperar RLS.
export async function listNaveStaff(): Promise<NaveStaffMember[]> {
  const admin = createAdminClient()
  const { data: nave } = await admin.from('organizations').select('id').eq('type', 'nave').limit(1).single()
  if (!nave) return []
  const { data } = await (admin as any)
    .from('profiles')
    .select('id, full_name, role')
    .eq('organization_id', (nave as any).id)
    .order('role')
    .order('full_name')
  return (data ?? []) as NaveStaffMember[]
}

export async function loginAsStaff(profileId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'PIN inválido' }

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('id, pin, organizations(type)')
    .eq('id', profileId)
    .single()
  if (!profile || profile.organizations?.type !== 'nave') return { ok: false, error: 'Usuario no encontrado' }
  if (profile.pin !== pin) return { ok: false, error: 'PIN incorrecto' }

  const { data: authUser } = await admin.auth.admin.getUserById(profileId)
  const email = authUser?.user?.email
  if (!email) return { ok: false, error: 'No se pudo iniciar sesión' }

  // El PIN visible ya se validó arriba contra profiles.pin; la contraseña
  // real (PIN_PREFIX + pin, igual que en LoginClient/updateUserPin) se usa
  // aquí solo para generar la sesión a través del flujo normal de Supabase
  // Auth, con el cliente de servidor para que la cookie de sesión quede
  // escrita en esta misma respuesta.
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: `pvprveo${pin}` })
  if (error) return { ok: false, error: 'No se pudo iniciar sesión' }
  return { ok: true }
}
