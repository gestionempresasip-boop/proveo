'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setFavoriteProduct(organizationId: string, productId: string, isFavorite: boolean) {
  const supabase = await createClient()
  const sb = supabase as any

  if (isFavorite) {
    const { error } = await sb
      .from('restaurant_favorite_products')
      .upsert({ organization_id: organizationId, product_id: productId }, { onConflict: 'organization_id,product_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb
      .from('restaurant_favorite_products')
      .delete()
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/catalogo')
  revalidatePath('/admin/productos')
}

// Guarda de golpe varios favoritos nuevos para un restaurante (botón
// "Guardar" del gestor de favoritos): así la nave puede marcar una tanda
// de productos y confirmarlos todos a la vez en una sola escritura.
export async function setFavoriteProductsBatch(organizationId: string, productIds: string[]) {
  if (productIds.length === 0) return
  const supabase = await createClient()
  const sb = supabase as any

  const { error } = await sb
    .from('restaurant_favorite_products')
    .upsert(
      productIds.map(product_id => ({ organization_id: organizationId, product_id })),
      { onConflict: 'organization_id,product_id', ignoreDuplicates: true }
    )
  if (error) throw new Error(error.message)

  revalidatePath('/catalogo')
  revalidatePath('/admin/productos')
}
