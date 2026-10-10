'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { NAVE_ORDER_SELECT, TRASH_DAYS } from '@/lib/ordersQuery'

// Carga bajo demanda de listas de pedidos de la nave (la pantalla ya no trae todo el histórico al entrar).
// Misma consulta y mismos permisos (RLS) que la página; solo la nave puede pedirlas.
async function assertNave() {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') throw new Error('No permitido')
}

/** Pedidos creados desde `fromIso` (hasta 500, los más recientes primero). */
export async function getOrdersSince(fromIso: string) {
  await assertNave()
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) throw new Error('Fecha no válida')
  const sb = (await createClient()) as any
  const { data, error } = await sb
    .from('orders')
    .select(NAVE_ORDER_SELECT)
    .is('deleted_at', null)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error('No se pudieron cargar los pedidos')
  return data ?? []
}

/** Papelera: pedidos eliminados en los últimos 90 días. */
export async function getTrashOrders() {
  await assertNave()
  const sb = (await createClient()) as any
  const { data, error } = await sb
    .from('orders')
    .select(NAVE_ORDER_SELECT)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', new Date(Date.now() - TRASH_DAYS * 86400000).toISOString())
    .order('deleted_at', { ascending: false })
    .limit(100)
  if (error) throw new Error('No se pudo cargar la papelera')
  return data ?? []
}
