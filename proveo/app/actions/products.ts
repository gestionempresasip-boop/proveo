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

  const { error } = await sb.from('products').insert({
    name,
    price,
    unit,
    category_id: category_id || null,
    description,
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
  const min_order_quantity = Number(formData.get('min_order_quantity')) || 1
  const order_increment = Number(formData.get('order_increment')) || 1

  const { error } = await sb.from('products').update({
    name,
    price,
    unit,
    category_id: category_id || null,
    description,
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
