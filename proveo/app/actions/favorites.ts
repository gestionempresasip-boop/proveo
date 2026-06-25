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
