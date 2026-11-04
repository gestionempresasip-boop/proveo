'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { assertUnlocked } from '@/lib/gateGuard'

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
