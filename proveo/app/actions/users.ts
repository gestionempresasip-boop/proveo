'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PIN_PREFIX = 'pvprveo'

async function assertIsNaveOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await (supabase as any)
    .from('profiles').select('role, organizations(type)').eq('id', user.id).single()
  const isNave = profile?.role === 'admin' || profile?.organizations?.type === 'nave'
  if (!isNave) throw new Error('Sin permisos')
}

// Cambia el PIN (contraseña) de un usuario y lo deja guardado para poder
// mostrarlo después — Supabase Auth no permite leer contraseñas existentes,
// así que el valor "visible" vive en profiles.pin y siempre se mantiene en
// sincronía con la contraseña real.
export async function updateUserPin(profileId: string, newPin: string) {
  await assertIsNaveOrAdmin()
  if (!/^\d{4}$/.test(newPin)) throw new Error('El PIN debe tener 4 dígitos')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(profileId, {
    password: PIN_PREFIX + newPin,
  })
  if (error) throw new Error(error.message)

  const { error: pinError } = await (admin as any).from('profiles').update({ pin: newPin }).eq('id', profileId)
  if (pinError) throw new Error(pinError.message)
  revalidatePath('/admin/usuarios')
}

export async function updateUserProfile(profileId: string, formData: FormData) {
  await assertIsNaveOrAdmin()
  const supabase = await createClient()
  const full_name = formData.get('full_name') as string
  const phone = (formData.get('phone') as string) || null

  const { error } = await (supabase as any).from('profiles').update({ full_name, phone }).eq('id', profileId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/usuarios')
}

function slugifyEmail(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

// Crea personal de la nave con login propio (ej. cocineros) — a diferencia
// de los restaurantes, que comparten un único email por organización, cada
// persona de la nave necesita su propia cuenta para tener "su" lista de
// tareas asignadas.
export async function createStaffUser(input: { full_name: string; role: 'cocinero' | 'nave_manager'; pin: string }) {
  await assertIsNaveOrAdmin()
  if (!input.full_name.trim()) throw new Error('Falta el nombre')
  if (!/^\d{4}$/.test(input.pin)) throw new Error('El PIN debe tener 4 dígitos')

  const admin = createAdminClient()
  const { data: nave } = await admin.from('organizations').select('id').eq('type', 'nave').limit(1).single()
  if (!nave) throw new Error('No se encontró la nave')

  const base = slugifyEmail(input.full_name) || 'personal'
  let email = `${base}@proveo.es`
  let attempt = 1
  // Reintenta con sufijo numérico si el email ya existe (nombres repetidos)
  for (;;) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: PIN_PREFIX + input.pin, email_confirm: true,
    })
    if (!error && created.user) {
      const { error: profileError } = await (admin as any).from('profiles').insert({
        id: created.user.id,
        organization_id: (nave as any).id,
        role: input.role,
        full_name: input.full_name.trim(),
        pin: input.pin,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw new Error(profileError.message)
      }
      revalidatePath('/admin/usuarios')
      return
    }
    if (error?.message?.toLowerCase().includes('already') && attempt < 10) {
      attempt += 1
      email = `${base}${attempt}@proveo.es`
      continue
    }
    throw new Error(error?.message ?? 'No se pudo crear el usuario')
  }
}
