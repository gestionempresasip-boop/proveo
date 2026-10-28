'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { assertUnlocked } from '@/lib/gateGuard'

// Clientes externos (distribuidores): organización propia con su usuario y PIN,
// los productos que la nave les asigna y el precio de cada uno.
// Todo se hace con la clave de servicio, pero solo tras comprobar que quien
// llama es la nave (o admin) y que ha desbloqueado la pestaña Productos.

const PIN_PREFIX = 'pvprveo'
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

async function assertNave() {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
  await assertUnlocked('productos')
  return profile
}

export type NewExternalClient = {
  name: string
  slug: string
  pin: string
  fiscalName?: string
  taxId?: string
  address?: string
  phone?: string
}

export async function createExternalClient(input: NewExternalClient): Promise<{ ok: boolean; error?: string }> {
  await assertNave()
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Escribe el nombre del cliente' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'La dirección de acceso solo puede llevar letras minúsculas, números y guiones (mínimo 3 caracteres)' }
  if (!/^\d{4}$/.test(input.pin)) return { ok: false, error: 'El PIN debe tener 4 cifras' }

  const admin = createAdminClient() as any
  const { data: taken } = await admin.from('organizations').select('id').eq('login_slug', slug).maybeSingle()
  if (taken) return { ok: false, error: 'Esa dirección de acceso ya está en uso' }

  const { data: org, error: orgErr } = await admin.from('organizations').insert({
    name,
    type: 'restaurante',
    is_external: true,
    login_slug: slug,
    fiscal_name: input.fiscalName?.trim() || null,
    tax_id: input.taxId?.trim() || null,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
  }).select('id').single()
  if (orgErr || !org) {
    return { ok: false, error: 'No se pudo crear el cliente. ¿Has ejecutado el SQL de clientes externos en Supabase?' }
  }

  const email = `ext-${slug}@proveo.es`
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PIN_PREFIX + input.pin,
    email_confirm: true,
  })
  if (userErr || !created?.user) {
    await admin.from('organizations').delete().eq('id', org.id)
    return { ok: false, error: 'No se pudo crear el usuario de acceso: ' + (userErr?.message ?? 'error desconocido') }
  }

  const { error: profErr } = await admin.from('profiles').insert({
    id: created.user.id,
    organization_id: org.id,
    role: 'restaurante_manager',
    full_name: name,
    pin: input.pin,
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return { ok: false, error: 'No se pudo crear el perfil: ' + profErr.message }
  }

  revalidatePath('/admin/clientes')
  return { ok: true }
}

export async function updateExternalClient(
  orgId: string,
  data: { name: string; fiscalName: string; taxId: string; address: string; phone: string },
): Promise<{ ok: boolean; error?: string }> {
  await assertNave()
  if (!data.name.trim()) return { ok: false, error: 'Escribe el nombre del cliente' }
  const admin = createAdminClient() as any
  const { error } = await admin.from('organizations').update({
    name: data.name.trim(),
    fiscal_name: data.fiscalName.trim() || null,
    tax_id: data.taxId.trim() || null,
    address: data.address.trim() || null,
    phone: data.phone.trim() || null,
  }).eq('id', orgId).eq('is_external', true)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/clientes')
  return { ok: true }
}

// Asigna productos al cliente (con su precio sin IVA) o los quita.
export async function saveClientProducts(
  orgId: string,
  upserts: { productId: string; price: number }[],
  removeIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await assertNave()
  const admin = createAdminClient() as any
  const { data: org } = await admin.from('organizations').select('id').eq('id', orgId).eq('is_external', true).maybeSingle()
  if (!org) return { ok: false, error: 'Cliente no encontrado' }
  for (const u of upserts) {
    if (!Number.isFinite(u.price) || u.price < 0) return { ok: false, error: 'Hay un precio no válido' }
  }
  if (upserts.length > 0) {
    const { error } = await admin.from('client_product_prices').upsert(
      upserts.map(u => ({ organization_id: orgId, product_id: u.productId, price: Math.round(u.price * 10000) / 10000, updated_at: new Date().toISOString() })),
      { onConflict: 'organization_id,product_id' },
    )
    if (error) return { ok: false, error: error.message }
  }
  if (removeIds.length > 0) {
    const { error } = await admin.from('client_product_prices').delete().eq('organization_id', orgId).in('product_id', removeIds)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/admin/clientes')
  return { ok: true }
}
