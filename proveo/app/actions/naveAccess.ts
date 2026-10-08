'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminDb, rowsOf } from '@/lib/serverAccess'
import { AREAS, FULL_ACCESS_LABEL, type Area } from '@/lib/areas'

// Usuarios de la nave con nombre y pestañas permitidas. Solo los gestiona Dirección (el acceso
// sin límite de pestañas). El PIN lo escribe quien crea el usuario: aquí no se inventa ninguno.
const PIN_PREFIX = 'pvprveo'

async function assertDireccion() {
  const profile = await getAuthProfile()
  const isDireccion = profile.organizations.type === 'nave' && !profile.areas && (profile.role === 'admin' || profile.role === 'nave_manager')
  if (!isDireccion) throw new Error(`Solo el acceso de ${FULL_ACCESS_LABEL} puede gestionar los usuarios de la nave`)
  return profile
}

const cleanAreas = (areas: unknown): Area[] =>
  (Array.isArray(areas) ? areas : []).filter((a): a is Area => (AREAS as readonly string[]).includes(a as string))

export type NaveUser = { id: string; name: string; areas: Area[]; pin: string | null }

type ProfileRow = { id: string; full_name: string | null; pin: string | null; areas: string[] | null }

/** Usuarios de la nave con pestañas limitadas (no incluye a Dirección). */
export async function listNaveUsers(): Promise<NaveUser[]> {
  const profile = await assertDireccion()
  const { data } = await adminDb().from('profiles').select('id, full_name, pin, areas')
    .eq('organization_id', profile.organization_id).not('areas', 'is', null).order('full_name')
  return rowsOf<ProfileRow>({ data }).map(r => ({ id: r.id, name: r.full_name ?? '', areas: cleanAreas(r.areas), pin: r.pin }))
}

export async function saveNaveUser(input: { id?: string; name: string; pin?: string; areas: Area[] }): Promise<{ created: boolean }> {
  const profile = await assertDireccion()
  const name = input.name.trim().slice(0, 40)
  const areas = cleanAreas(input.areas)
  if (!name) throw new Error('Escribe el nombre')
  if (!areas.some(a => a !== 'precios')) throw new Error('Marca al menos una pestaña')
  if (input.pin !== undefined && input.pin !== '' && !/^\d{4}$/.test(input.pin)) throw new Error('El PIN tiene que ser de 4 dígitos')

  const db = adminDb()
  const auth = createAdminClient().auth.admin

  // Nombre repetido en la nave: se pide otro para no confundir a la hora de entrar
  const { data: sameName } = await db.from('profiles').select('id').eq('organization_id', profile.organization_id).ilike('full_name', name)
  if (rowsOf<{ id: string }>({ data: sameName }).some(r => r.id !== input.id)) throw new Error('Ya hay un usuario con ese nombre')

  if (input.id) {
    const { data: target } = await db.from('profiles').select('id, areas').eq('id', input.id).eq('organization_id', profile.organization_id).maybeSingle()
    if (!target || !target.areas) throw new Error('Usuario no válido')
    if (input.pin) {
      const { error } = await auth.updateUserById(input.id, { password: PIN_PREFIX + input.pin })
      if (error) throw new Error('No se pudo cambiar el PIN')
    }
    await db.from('profiles').update({ full_name: name, areas, ...(input.pin ? { pin: input.pin } : {}) }).eq('id', input.id)
    revalidatePath('/admin/usuarios')
    return { created: false }
  }

  if (!input.pin) throw new Error('Escribe un PIN de 4 dígitos')
  // El correo es interno: el usuario nunca lo ve ni lo escribe (entra por nombre + PIN).
  const email = `nave-${randomBytes(4).toString('hex')}@proveo.es`
  const { data: created, error } = await auth.createUser({ email, password: PIN_PREFIX + input.pin, email_confirm: true })
  if (error || !created.user) throw new Error('No se pudo crear el usuario')
  const { error: pErr } = await db.from('profiles').insert({
    id: created.user.id, organization_id: profile.organization_id, role: 'nave_manager', full_name: name, pin: input.pin, areas,
  })
  if (pErr) {
    await auth.deleteUser(created.user.id) // no dejar un usuario sin perfil
    throw new Error('No se pudo crear el perfil (¿está aplicada la migración de áreas?)')
  }
  revalidatePath('/admin/usuarios')
  return { created: true }
}

// Borra un usuario de la nave. Si ya tiene actividad (pedidos, albaranes…) no se puede borrar del
// todo: se le quitan todas las pestañas y se le cambia el PIN al azar, y deja de poder entrar.
export async function deleteNaveUser(id: string): Promise<{ disabled: boolean }> {
  const profile = await assertDireccion()
  const db = adminDb()
  const auth = createAdminClient().auth.admin
  const { data: target } = await db.from('profiles').select('id, areas').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle()
  if (!target || !target.areas) throw new Error('Usuario no válido') // nunca Dirección

  const { error } = await db.from('profiles').delete().eq('id', id)
  if (!error) {
    await auth.deleteUser(id)
    revalidatePath('/admin/usuarios')
    return { disabled: false }
  }
  await auth.updateUserById(id, { password: PIN_PREFIX + randomBytes(8).toString('hex') })
  await db.from('profiles').update({ areas: [], pin: null }).eq('id', id)
  revalidatePath('/admin/usuarios')
  return { disabled: true }
}

// ── Entrada (sin sesión todavía) ──────────────────────────────────────────────

/** Nombres que se pueden elegir al entrar en la nave. Solo nombres, nada más. */
export async function listLoginNaveUsers(): Promise<{ id: string; name: string }[]> {
  const db = adminDb()
  const { data: org } = await db.from('organizations').select('id').eq('type', 'nave').limit(1).maybeSingle()
  if (!org) return []
  const { data } = await db.from('profiles').select('id, full_name, areas').eq('organization_id', org.id).order('full_name')
  const rows = rowsOf<{ id: string; full_name: string | null; areas: string[] | null }>({ data })
  const active = rows.filter(r => r.areas === null || r.areas.length > 0) // los desactivados no salen
  const direccion = active.filter(r => r.areas === null)
  const others = active.filter(r => r.areas !== null)
  return [
    ...direccion.slice(0, 1).map(r => ({ id: r.id, name: FULL_ACCESS_LABEL })),
    ...others.map(r => ({ id: r.id, name: r.full_name ?? '' })),
  ]
}

/** Entra como un usuario de la nave: nombre + PIN. El correo interno no sale del servidor. */
export async function loginNaveUser(profileId: string, pin: string): Promise<{ ok: boolean }> {
  if (!/^\d{4}$/.test(pin)) return { ok: false }
  const db = adminDb()
  const { data: p } = await db.from('profiles').select('id, organizations(type)').eq('id', profileId).maybeSingle()
  const org = (p as unknown as { organizations: { type: string } | null } | null)?.organizations
  if (!p || org?.type !== 'nave') return { ok: false }
  const { data: u } = await createAdminClient().auth.admin.getUserById(profileId)
  if (!u.user?.email) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: u.user.email, password: PIN_PREFIX + pin })
  return { ok: !error }
}
