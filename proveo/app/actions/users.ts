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

  await (admin as any).from('profiles').update({ pin: newPin }).eq('id', profileId)
  revalidatePath('/admin/usuarios')
}

export async function updateUserProfile(profileId: string, formData: FormData) {
  await assertIsNaveOrAdmin()
  const supabase = await createClient()
  const full_name = formData.get('full_name') as string
  const phone = (formData.get('phone') as string) || null

  await (supabase as any).from('profiles').update({ full_name, phone }).eq('id', profileId)
  revalidatePath('/admin/usuarios')
}
