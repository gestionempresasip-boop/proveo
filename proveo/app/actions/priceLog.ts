'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { assertUnlocked } from '@/lib/gateGuard'
import { fetchAll } from '@/lib/fetchAll'
import { marginOfLog } from '@/lib/marginLog'

export type CostHistoryEntry = {
  changed_at: string
  old_cost: number | null; new_cost: number | null
  old_price: number | null; new_price: number | null
  old_margin: number | null; new_margin: number | null   // fracción (0,25 = 25 %)
}

// Historial de coste y precio de UN producto (para la ficha), del más reciente al más antiguo.
export async function getProductCostHistory(productId: string): Promise<CostHistoryEntry[]> {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
  await assertUnlocked('productos')

  const sb = (await createClient()) as any
  const read = (cols: string) => sb
    .from('product_price_log')
    .select(cols)
    .eq('product_id', productId)
    .order('changed_at', { ascending: false })
    .limit(200)
  // Si aún no se ha ejecutado el SQL del margen, se lee sin esas dos columnas y el margen se calcula
  let res = await read('changed_at, old_cost, new_cost, old_price, new_price, old_margin, new_margin')
  if (res.error) res = await read('changed_at, old_cost, new_cost, old_price, new_price')
  if (res.error) throw new Error('No se pudo leer el historial (falta ejecutar el SQL del registro de cambios)')
  const n = (v: unknown) => (v == null ? null : Number(v))
  return ((res.data ?? []) as Record<string, unknown>[]).map(r => {
    const oc = n(r.old_cost), nc = n(r.new_cost), op = n(r.old_price), np = n(r.new_price)
    return {
      changed_at: String(r.changed_at), old_cost: oc, new_cost: nc, old_price: op, new_price: np,
      old_margin: marginOfLog(r.old_margin, oc, op), new_margin: marginOfLog(r.new_margin, nc, np),
    }
  })
}

export type LastCostChange = { old_cost: number | null; new_cost: number | null; changed_at: string }

// Último cambio de COSTE de cada producto (para añadirlo a la exportación de productos).
export async function getLastCostChanges(): Promise<Record<string, LastCostChange>> {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
  await assertUnlocked('productos')

  const sb = (await createClient()) as any
  type Row = { product_id: string; old_cost: number | string | null; new_cost: number | string | null; changed_at: string }
  const rows = await fetchAll<Row>((a, b) =>
    sb.from('product_price_log').select('product_id, old_cost, new_cost, changed_at').order('changed_at', { ascending: false }).order('id').range(a, b))
  const r4 = (v: unknown) => Math.round(Number(v ?? 0) * 10000)
  const out: Record<string, LastCostChange> = {}
  for (const r of rows) {
    if (out[r.product_id] || r4(r.old_cost) === r4(r.new_cost)) continue   // el más reciente en el que cambió el coste
    out[r.product_id] = { old_cost: r.old_cost == null ? null : Number(r.old_cost), new_cost: r.new_cost == null ? null : Number(r.new_cost), changed_at: r.changed_at }
  }
  return out
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
