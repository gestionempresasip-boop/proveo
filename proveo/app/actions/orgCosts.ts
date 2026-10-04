'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type OrgCostItem = {
  id: string
  organization_id: string
  kind: 'fijo' | 'variable'
  mode: 'monthly' | 'percent'
  name: string
  value: number
  active: boolean
}

export type RestaurantSaleRow = { organization_id: string; month: string; amount: number }

// Solo la nave/admin gestionan costes y ventas (la tabla no tiene políticas
// RLS: todo pasa por aquí, con la service role, tras esta comprobación).
async function assertIsNaveOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await (supabase as any)
    .from('profiles').select('role, organizations(type)').eq('id', user.id).single()
  const ok = profile?.role === 'admin' || profile?.organizations?.type === 'nave'
  if (!ok) throw new Error('Sin permisos')
}

function validate(input: { name: string; value: number; mode: string; kind: string }) {
  if (!input.name.trim()) throw new Error('Falta el nombre')
  if (!(input.value >= 0)) throw new Error('Importe inválido')
  if (input.mode === 'percent' && input.value > 100) throw new Error('Un porcentaje no puede pasar de 100')
  if (!['monthly', 'percent'].includes(input.mode)) throw new Error('Tipo inválido')
  if (!['fijo', 'variable'].includes(input.kind)) throw new Error('Clase inválida')
}

export async function createCostItem(input: { organizationId: string; kind: 'fijo' | 'variable'; mode: 'monthly' | 'percent'; name: string; value: number }) {
  await assertIsNaveOrAdmin()
  validate(input)
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('org_cost_items')
    .insert({ organization_id: input.organizationId, kind: input.kind, mode: input.mode, name: input.name.trim(), value: input.value })
    .select('id, organization_id, kind, mode, name, value, active')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
  return { ...data, value: Number(data.value) } as OrgCostItem
}

export async function updateCostItem(id: string, input: { kind: 'fijo' | 'variable'; mode: 'monthly' | 'percent'; name: string; value: number }) {
  await assertIsNaveOrAdmin()
  validate(input)
  const admin = createAdminClient() as any
  const { error } = await admin
    .from('org_cost_items')
    .update({ kind: input.kind, mode: input.mode, name: input.name.trim(), value: input.value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}

export async function toggleCostItemActive(id: string, active: boolean) {
  await assertIsNaveOrAdmin()
  const admin = createAdminClient() as any
  const { error } = await admin.from('org_cost_items').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}

export async function deleteCostItem(id: string) {
  await assertIsNaveOrAdmin()
  const admin = createAdminClient() as any
  const { error } = await admin.from('org_cost_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}

/** month = 'YYYY-MM'. amount vacío/0 borra el dato de ese mes. */
export async function upsertRestaurantSales(organizationId: string, month: string, amount: number) {
  await assertIsNaveOrAdmin()
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mes inválido')
  if (!(amount >= 0)) throw new Error('Importe inválido')
  const admin = createAdminClient() as any
  if (amount === 0) {
    const { error } = await admin.from('restaurant_monthly_sales').delete().eq('organization_id', organizationId).eq('month', `${month}-01`)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('restaurant_monthly_sales')
      .upsert({ organization_id: organizationId, month: `${month}-01`, amount, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,month' })
    if (error) throw new Error(error.message)
  }
  revalidatePath('/estadisticas')
}
