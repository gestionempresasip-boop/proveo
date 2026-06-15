'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any

  const name = formData.get('name') as string
  const price = Number(formData.get('price')) || 0
  const unit = formData.get('unit') as string
  const category_id = formData.get('category_id') as string || null
  const description = formData.get('description') as string || null
  const image_url = (formData.get('image_url') as string)?.trim() || null

  const { error } = await sb.from('products').insert({
    name, price, unit,
    category_id: category_id || null,
    description,
    image_url: image_url || null,
    is_active: true,
    visibility: 'todos',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/productos')
}

export async function updateProduct(productId: string, formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any

  const name = formData.get('name') as string
  const price = Number(formData.get('price')) || 0
  const unit = formData.get('unit') as string
  const category_id = formData.get('category_id') as string || null
  const description = formData.get('description') as string || null
  const image_url = (formData.get('image_url') as string)?.trim() || null
  const min_order_quantity = Number(formData.get('min_order_quantity')) || 1
  const order_increment = Number(formData.get('order_increment')) || 1

  const { error } = await sb.from('products').update({
    name, price, unit,
    category_id: category_id || null,
    description,
    image_url: image_url || null,
    min_order_quantity,
    order_increment,
  }).eq('id', productId)

  if (error) throw new Error(error.message)
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
