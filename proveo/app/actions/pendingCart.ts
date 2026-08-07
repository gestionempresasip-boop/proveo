'use server'

import { createClient } from '@/lib/supabase/server'

export type PendingCartPayload = {
  cart: Record<string, number>
  cartModes: Record<string, 'unidad' | 'cajon'>
  notes: string
  destination: 'sala' | 'cocina' | ''
}

// Guarda la cesta a medio hacer del restaurante en el servidor, visible
// desde cualquier dispositivo con esa misma sesión de restaurante — no
// solo en el navegador donde se empezó. No usamos revalidatePath porque
// se llama en cada tecleo (autoguardado) y no queremos recargar toda la
// página del catálogo en cada cambio.
export async function savePendingCart(organizationId: string, payload: PendingCartPayload, userName: string | null) {
  const supabase = await createClient()
  const sb = supabase as any

  const isEmpty = Object.keys(payload.cart).length === 0 && !payload.notes && !payload.destination
  if (isEmpty) {
    await sb.from('pending_carts').delete().eq('organization_id', organizationId)
    return
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await sb.from('pending_carts').upsert(
    {
      organization_id: organizationId,
      cart: payload.cart,
      cart_modes: payload.cartModes,
      notes: payload.notes || null,
      destination: payload.destination || null,
      updated_by: user?.id ?? null,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )
  if (error) throw new Error(error.message)
}

export async function clearPendingCart(organizationId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb.from('pending_carts').delete().eq('organization_id', organizationId)
  if (error) throw new Error(error.message)
}

export async function getPendingCart(organizationId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { data } = await sb.from('pending_carts').select('*').eq('organization_id', organizationId).maybeSingle()
  return data ?? null
}
