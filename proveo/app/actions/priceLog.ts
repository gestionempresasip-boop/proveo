'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { assertUnlocked } from '@/lib/gateGuard'

export type CostHistoryEntry = {
  changed_at: string
  old_cost: number | null; new_cost: number | null
  old_price: number | null; new_price: number | null
}

// Historial de coste y precio de UN producto (para la ficha), del más reciente al más antiguo.
export async function getProductCostHistory(productId: string): Promise<CostHistoryEntry[]> {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
  await assertUnlocked('productos')

  const sb = (await createClient()) as any
  const { data, error } = await sb
    .from('product_price_log')
    .select('changed_at, old_cost, new_cost, old_price, new_price')
    .eq('product_id', productId)
    .order('changed_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('No se pudo leer el historial (falta ejecutar el SQL del registro de cambios)')
  const n = (v: unknown) => (v == null ? null : Number(v))
  return ((data ?? []) as CostHistoryEntry[]).map(r => ({
    changed_at: r.changed_at, old_cost: n(r.old_cost), new_cost: n(r.new_cost), old_price: n(r.old_price), new_price: n(r.new_price),
  }))
}

// Marca como "ya pasados al programa de facturación" todos los cambios pendientes de estos productos.
export async function markPriceChangesBilled(productIds: string[]): Promise<{ marked: number }> {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
  await assertUnlocked('productos')

  const ids = [...new Set((productIds ?? []).filter(id => typeof id === 'string'))].slice(0, 2000)
  if (ids.length === 0) return { marked: 0 }

  const sb = (await createClient()) as any
  let marked = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from('product_price_log')
      .update({ billed_at: new Date().toISOString() })
      .in('product_id', ids.slice(i, i + 200))
      .is('billed_at', null)
      .select('id')
    if (error) throw new Error('No se pudieron marcar los cambios')
    marked += (data ?? []).length
  }
  revalidatePath('/admin/productos/cambios')
  return { marked }
}
