'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

type BackupData = {
  products: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  category_links: Record<string, unknown>[]
  nave_inventory: Record<string, unknown>[]
  restaurant_inventory: Record<string, unknown>[]
}

// Guarda una foto completa de productos + categorías + stock (nave y
// restaurantes) en una sola fila JSON, para poder restaurarla más tarde.
export async function createBackup(label: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const profile = await getAuthProfile()

  const [
    { data: products },
    { data: categories },
    { data: categoryLinks },
    { data: naveInventory },
    { data: restaurantInventory },
  ] = await Promise.all([
    sb.from('products').select('*'),
    sb.from('product_categories').select('*'),
    sb.from('product_category_links').select('*'),
    sb.from('nave_inventory').select('*'),
    sb.from('restaurant_inventory').select('*'),
  ])

  const data: BackupData = {
    products: products ?? [],
    categories: categories ?? [],
    category_links: categoryLinks ?? [],
    nave_inventory: naveInventory ?? [],
    restaurant_inventory: restaurantInventory ?? [],
  }

  const { error } = await sb.from('backups').insert({
    label: label.trim() || new Date().toLocaleString('es-ES'),
    data,
    products_count: data.products.length,
    categories_count: data.categories.length,
    created_by: profile.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/inventario')
}

export async function listBackups() {
  const supabase = await createClient()
  const sb = supabase as any
  const { data, error } = await sb
    .from('backups')
    .select('id, label, products_count, categories_count, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function deleteBackup(id: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb.from('backups').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/inventario')
}

// Restaura productos, categorías y stock a como estaban en la copia elegida.
// Solo toca lo que hay dentro de la copia (upsert por id): productos creados
// después de la copia no se ven afectados ni se borran.
export async function restoreBackup(id: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: backup, error } = await sb.from('backups').select('data').eq('id', id).single()
  if (error || !backup) throw new Error(error?.message ?? 'Copia no encontrada')
  const { products, categories, category_links, nave_inventory, restaurant_inventory } = backup.data as BackupData

  if (categories.length > 0) {
    const { error: e1 } = await sb.from('product_categories').upsert(categories, { onConflict: 'id' })
    if (e1) throw new Error(e1.message)
  }
  if (products.length > 0) {
    const { error: e2 } = await sb.from('products').upsert(products, { onConflict: 'id' })
    if (e2) throw new Error(e2.message)
  }
  if (category_links.length > 0) {
    const productIds = products.map(p => p.id)
    await sb.from('product_category_links').delete().in('product_id', productIds)
    const { error: e3 } = await sb.from('product_category_links').insert(category_links)
    if (e3) throw new Error(e3.message)
  }
  if (nave_inventory.length > 0) {
    const { error: e4 } = await sb.from('nave_inventory').upsert(nave_inventory, { onConflict: 'product_id' })
    if (e4) throw new Error(e4.message)
  }
  if (restaurant_inventory.length > 0) {
    const { error: e5 } = await sb.from('restaurant_inventory').upsert(restaurant_inventory, { onConflict: 'organization_id,product_id' })
    if (e5) throw new Error(e5.message)
  }

  revalidatePath('/inventario')
  revalidatePath('/admin/productos')
  revalidatePath('/catalogo')
  return { restored: true }
}
