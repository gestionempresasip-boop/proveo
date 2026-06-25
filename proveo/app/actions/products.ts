'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function syncProductCategories(sb: any, productId: string, categoryIds: string[]) {
  await sb.from('product_category_links').delete().eq('product_id', productId)
  if (categoryIds.length > 0) {
    await sb.from('product_category_links').insert(
      categoryIds.map(category_id => ({ product_id: productId, category_id }))
    )
  }
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any

  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const category_ids = formData.getAll('category_ids') as string[]
  const category_id = category_ids[0] ?? null
  const description = formData.get('description') as string || null
  const image_url = (formData.get('image_url') as string)?.trim() || null

  const cost_price = Number(formData.get('cost_price')) || 0
  const margin     = Number(formData.get('margin'))     || 0  // decimal e.g. 0.25
  const iva_rate   = Number(formData.get('iva_rate'))   || 0.10
  const price_override = Number(formData.get('price_override')) || 0
  const price_manual   = Number(formData.get('price')) || 0
  // price sin IVA: prefer calculator override, else manual, else cost+margin
  const price = price_override > 0 ? price_override
    : cost_price > 0 ? cost_price * (1 + margin)
    : price_manual

  const { data: product, error } = await sb.from('products').insert({
    name, price, unit,
    category_id,
    description,
    image_url: image_url || null,
    cost_price: cost_price || null,
    margin: margin || null,
    iva_rate,
    is_active: true,
    visibility: 'todos',
    pending_review: !(cost_price > 0),
  }).select().single()

  if (error) throw new Error(error.message)
  if (product) await syncProductCategories(sb, product.id, category_ids)
  revalidatePath('/admin/productos')
}

export async function updateProduct(productId: string, formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any

  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const category_ids = formData.getAll('category_ids') as string[]
  const category_id = category_ids[0] ?? null
  const description = formData.get('description') as string || null
  const image_url = (formData.get('image_url') as string)?.trim() || null
  const min_order_quantity = Number(formData.get('min_order_quantity')) || 1
  const order_increment = Number(formData.get('order_increment')) || 1

  const cost_price = Number(formData.get('cost_price')) || 0
  const margin     = Number(formData.get('margin'))     || 0
  const iva_rate   = Number(formData.get('iva_rate'))   || 0.10
  const price_override = Number(formData.get('price_override')) || 0
  const price_manual   = Number(formData.get('price')) || 0
  const price = price_override > 0 ? price_override
    : cost_price > 0 ? cost_price * (1 + margin)
    : price_manual

  const updates: Record<string, unknown> = {
    name, price, unit,
    category_id,
    description,
    image_url: image_url || null,
    min_order_quantity,
    order_increment,
    cost_price: cost_price || null,
    margin: margin || null,
    iva_rate,
  }
  // Editar un producto solo puede SACARLO de "pendientes" (al ponerle coste),
  // nunca volver a metérselo si ya estaba categorizado y en uso.
  if (cost_price > 0) updates.pending_review = false

  const { error } = await sb.from('products').update(updates).eq('id', productId)

  if (error) throw new Error(error.message)
  await syncProductCategories(sb, productId, category_ids)
  revalidatePath('/admin/productos')
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient()
  await (supabase as any)
    .from('products')
    .update({ is_active: !isActive })
    .eq('id', productId)
  revalidatePath('/admin/productos')
}

export async function softDeleteProduct(productId: string) {
  const supabase = await createClient()
  await (supabase as any)
    .from('products')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', productId)
  revalidatePath('/admin/productos')
  revalidatePath('/inventario')
}

// ── Category actions ─────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Elaboraciones nave',   color: '#1B4332', order_index: 1 },
  { name: 'Carnes y aves',        color: '#DC2626', order_index: 2 },
  { name: 'Pescados y mariscos',  color: '#0EA5E9', order_index: 3 },
  { name: 'Frutas',               color: '#F97316', order_index: 4 },
  { name: 'Verduras y hortalizas',color: '#16A34A', order_index: 5 },
  { name: 'Lácteos y huevos',     color: '#F59E0B', order_index: 6 },
  { name: 'Vinos y bebidas',      color: '#7C3AED', order_index: 7 },
  { name: 'Secos y conservas',    color: '#78716C', order_index: 8 },
  { name: 'Salsas y condimentos', color: '#CA8A04', order_index: 9 },
  { name: 'Panadería y masas',    color: '#D97706', order_index: 10 },
  { name: 'Utillaje y menaje',    color: '#64748B', order_index: 11 },
  { name: 'Uniformes y ropa',     color: '#374151', order_index: 12 },
]

export async function seedDefaultCategories() {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: existing } = await sb.from('product_categories').select('name')
  const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name))

  const toInsert = DEFAULT_CATEGORIES.filter(c => !existingNames.has(c.name))
  if (toInsert.length > 0) {
    await sb.from('product_categories').insert(toInsert)
  }
  revalidatePath('/admin/productos')
}

export async function createCategory(formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any
  const name = (formData.get('name') as string).trim()
  const color = (formData.get('color') as string) || '#6B7280'
  if (!name) throw new Error('Nombre requerido')
  await sb.from('product_categories').insert({ name, color, order_index: 99 })
  revalidatePath('/admin/productos')
}

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  // unlink products from this category before deleting
  await sb.from('products').update({ category_id: null }).eq('category_id', categoryId)
  await sb.from('product_categories').delete().eq('id', categoryId)
  revalidatePath('/admin/productos')
}

export async function updateCategory(categoryId: string, formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any
  const name = (formData.get('name') as string).trim()
  const color = (formData.get('color') as string) || '#6B7280'
  if (!name) throw new Error('Nombre requerido')
  await sb.from('product_categories').update({ name, color }).eq('id', categoryId)
  revalidatePath('/admin/productos')
}

// Fusiona dos categorías: mueve todos los productos de "fromId" a "toId"
// (tanto la categoría principal como la tabla puente) y borra "fromId".
export async function mergeCategories(fromId: string, toId: string) {
  if (fromId === toId) return
  const supabase = await createClient()
  const sb = supabase as any

  const { error: err1 } = await sb.from('products').update({ category_id: toId }).eq('category_id', fromId)
  if (err1) throw new Error(err1.message)

  const { data: links } = await sb.from('product_category_links').select('product_id').eq('category_id', fromId)
  await sb.from('product_category_links').delete().eq('category_id', fromId)
  if (links?.length) {
    const { error: err2 } = await sb.from('product_category_links').upsert(
      links.map((l: any) => ({ product_id: l.product_id, category_id: toId })),
      { onConflict: 'product_id,category_id', ignoreDuplicates: true }
    )
    if (err2) throw new Error(err2.message)
  }

  const { error: err3 } = await sb.from('product_categories').delete().eq('id', fromId)
  if (err3) throw new Error(err3.message)
  revalidatePath('/admin/productos')
}

export type BulkPricingField = 'precio_final' | 'coste' | 'margen'
export type BulkPricingMode = 'fixed' | 'percent'

// Modifica precio final (con IVA), precio de coste o margen de varios
// productos a la vez, sumando una cantidad fija o un porcentaje.
// Devuelve cuántos productos se actualizaron y cuántos se saltaron
// (coste/margen no aplican a productos sin coste puesto).
export async function bulkAdjustPricing(
  productIds: string[],
  field: BulkPricingField,
  mode: BulkPricingMode,
  value: number,
) {
  if (productIds.length === 0 || !value) return { updated: 0, skipped: 0 }
  const supabase = await createClient()
  const sb = supabase as any

  const { data: products } = await sb
    .from('products')
    .select('id, price, cost_price, margin, iva_rate')
    .in('id', productIds)

  let skipped = 0
  const updates = (products ?? []).map((p: any) => {
    const iva = Number(p.iva_rate) || 0
    const cost = Number(p.cost_price) || 0
    const margin = Number(p.margin) || 0
    const currentPrice = Number(p.price) || 0

    if (field === 'precio_final') {
      const currentFinal = currentPrice * (1 + iva)
      const newFinal = mode === 'fixed' ? currentFinal + value : currentFinal * (1 + value / 100)
      const newPrice = Math.max(0, newFinal) / (1 + iva)
      return { id: p.id, price: Math.max(0, newPrice) }
    }
    if (field === 'coste') {
      if (cost <= 0) { skipped++; return null }
      const newCost = mode === 'fixed' ? cost + value : cost * (1 + value / 100)
      const safeCost = Math.max(0, newCost)
      return { id: p.id, cost_price: safeCost, price: safeCost * (1 + margin) }
    }
    // margen — value en puntos porcentuales (fixed) o % relativo (percent)
    if (cost <= 0) { skipped++; return null }
    const newMargin = mode === 'fixed' ? margin + value / 100 : margin * (1 + value / 100)
    const safeMargin = Math.max(0, newMargin)
    return { id: p.id, margin: safeMargin, price: cost * (1 + safeMargin) }
  }).filter(Boolean) as { id: string; [key: string]: unknown }[]

  await Promise.all(updates.map(u => {
    const { id, ...rest } = u
    return sb.from('products').update(rest).eq('id', id)
  }))

  revalidatePath('/admin/productos')
  return { updated: updates.length, skipped }
}

// Mueve todos los productos de una categoría a otra (sin borrar la categoría de origen)
export async function moveProductsToCategory(productIds: string[], targetCategoryId: string) {
  if (productIds.length === 0) return
  const supabase = await createClient()
  const sb = supabase as any

  const { error: err1 } = await sb.from('products').update({ category_id: targetCategoryId }).in('id', productIds)
  if (err1) throw new Error(err1.message)

  await sb.from('product_category_links').delete().in('product_id', productIds).neq('category_id', targetCategoryId)
  const { error: err2 } = await sb.from('product_category_links').upsert(
    productIds.map(product_id => ({ product_id, category_id: targetCategoryId })),
    { onConflict: 'product_id,category_id', ignoreDuplicates: true }
  )
  if (err2) throw new Error(err2.message)
  revalidatePath('/admin/productos')
}
