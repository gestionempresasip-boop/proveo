'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProductAndPromote(
  product: { name: string; unit: string; cost_price: number; iva_rate: number; margin: number },
  promo: { label: string; notes: string | null; expiresAt: string | null },
): Promise<{ id: string; name: string; unit: string }> {
  const supabase = await createClient()
  const sb = supabase as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  // price = coste × (1 + margen), sin IVA — igual que createProduct en products.ts
  const price = product.cost_price * (1 + product.margin)

  const { data: newProduct, error: pErr } = await sb.from('products').insert({
    name: product.name.trim(),
    unit: product.unit,
    price,
    cost_price: product.cost_price,
    margin: product.margin,
    iva_rate: product.iva_rate,
    is_active: true,
    visibility: 'todos',
    pending_review: !(product.cost_price > 0 && product.margin > 0),
  }).select('id, name, unit').single()

  if (pErr) throw new Error(pErr.message)

  await sb.from('nave_inventory').insert({ product_id: newProduct.id, current_stock: 0, min_stock: 0 })

  const { error: promoErr } = await sb.from('promotions').insert({
    product_id: newProduct.id,
    label: promo.label.trim(),
    notes: promo.notes?.trim() || null,
    expires_at: promo.expiresAt || null,
    created_by: session.user.id,
  })
  if (promoErr) throw new Error(promoErr.message)

  revalidatePath('/promociones')
  revalidatePath('/catalogo')
  revalidatePath('/admin/productos')
  revalidatePath('/inventario')

  return newProduct
}

export async function upsertPromotion(
  productId: string,
  label: string,
  notes: string | null,
  expiresAt: string | null,
) {
  const supabase = await createClient()
  const sb = supabase as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const { error } = await sb.from('promotions').upsert(
    {
      product_id: productId,
      label: label.trim(),
      notes: notes?.trim() || null,
      expires_at: expiresAt || null,
      created_by: session.user.id,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'product_id' },
  )
  if (error) throw error

  revalidatePath('/promociones')
  revalidatePath('/catalogo')
}

export async function removePromotion(id: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb.from('promotions').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/promociones')
  revalidatePath('/catalogo')
}
