'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertInventory(
  productId: string,
  currentStock: number,
  minStock: number,
  isNave: boolean,
  organizationId: string,
) {
  const supabase = await createClient()
  const sb = supabase as any

  if (isNave) {
    await sb.from('nave_inventory').upsert(
      { product_id: productId, current_stock: currentStock, min_stock: minStock, last_updated: new Date().toISOString() },
      { onConflict: 'product_id' }
    )
  } else {
    await sb.from('restaurant_inventory').upsert(
      { product_id: productId, organization_id: organizationId, current_stock: currentStock, min_stock: minStock, last_updated: new Date().toISOString() },
      { onConflict: 'organization_id,product_id' }
    )
  }

  revalidatePath('/inventario')
}
