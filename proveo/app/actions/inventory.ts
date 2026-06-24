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
    const { data: existing } = await sb
      .from('nave_inventory')
      .select('current_stock')
      .eq('product_id', productId)
      .maybeSingle()
    const wasOutOfStock = !existing || Number(existing.current_stock) <= 0
    const isRestock = wasOutOfStock && currentStock > 0

    await sb.from('nave_inventory').upsert(
      {
        product_id: productId, current_stock: currentStock, min_stock: minStock,
        last_updated: new Date().toISOString(),
        ...(isRestock ? { last_restocked_at: new Date().toISOString() } : {}),
      },
      { onConflict: 'product_id' }
    )
  } else {
    await sb.from('restaurant_inventory').upsert(
      { product_id: productId, organization_id: organizationId, current_stock: currentStock, min_stock: minStock, last_updated: new Date().toISOString() },
      { onConflict: 'organization_id,product_id' }
    )
  }

  // Log snapshot for history (graceful — table may not exist yet)
  try {
    const { data: product } = await sb
      .from('products')
      .select('name, unit')
      .eq('id', productId)
      .single()
    const { data: org } = await sb
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()
    if (product && org) {
      await sb.from('inventory_log').insert({
        product_id: productId,
        product_name: product.name,
        product_unit: product.unit,
        organization_id: organizationId,
        organization_name: org.name,
        stock_value: currentStock,
        min_stock: minStock,
      })
    }
  } catch {
    // inventory_log table may not exist yet — safe to ignore
  }

  revalidatePath('/inventario')
}

// Asigna el mismo stock mínimo a varios productos a la vez (sin tocar el
// stock actual de cada uno, que se conserva).
export async function bulkSetMinStock(
  productIds: string[],
  minStock: number,
  isNave: boolean,
  organizationId: string,
) {
  if (productIds.length === 0) return { updated: 0 }
  const supabase = await createClient()
  const sb = supabase as any

  if (isNave) {
    const { data: existing } = await sb.from('nave_inventory').select('product_id, current_stock').in('product_id', productIds)
    const stockById = new Map((existing ?? []).map((r: any) => [r.product_id, r.current_stock]))
    await sb.from('nave_inventory').upsert(
      productIds.map(id => ({
        product_id: id,
        current_stock: stockById.get(id) ?? 0,
        min_stock: minStock,
        last_updated: new Date().toISOString(),
      })),
      { onConflict: 'product_id' }
    )
  } else {
    const { data: existing } = await sb.from('restaurant_inventory').select('product_id, current_stock').eq('organization_id', organizationId).in('product_id', productIds)
    const stockById = new Map((existing ?? []).map((r: any) => [r.product_id, r.current_stock]))
    await sb.from('restaurant_inventory').upsert(
      productIds.map(id => ({
        product_id: id,
        organization_id: organizationId,
        current_stock: stockById.get(id) ?? 0,
        min_stock: minStock,
        last_updated: new Date().toISOString(),
      })),
      { onConflict: 'organization_id,product_id' }
    )
  }

  revalidatePath('/inventario')
  return { updated: productIds.length }
}

export async function getInventoryHistory(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const supabase = await createClient()
  const sb = supabase as any

  let query = sb
    .from('inventory_log')
    .select('*')
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: false })
    .limit(500)

  if (dateFrom) query = query.gte('recorded_at', dateFrom)
  if (dateTo) {
    const end = new Date(dateTo)
    end.setDate(end.getDate() + 1)
    query = query.lt('recorded_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}
