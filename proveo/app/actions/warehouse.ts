'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertWarehouseItem(formData: FormData, organizationId: string, itemId?: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const payload = {
    organization_id: organizationId,
    category_id:    (formData.get('category_id') as string) || null,
    name:           formData.get('name') as string,
    description:    (formData.get('description') as string) || null,
    unit:           (formData.get('unit') as string) || 'unidad',
    current_stock:  Number(formData.get('current_stock')) || 0,
    min_stock:      Number(formData.get('min_stock')) || 0,
    supplier:       (formData.get('supplier') as string) || null,
    notes:          (formData.get('notes') as string) || null,
    updated_at:     new Date().toISOString(),
  }

  if (itemId) {
    const { error } = await sb.from('warehouse_items').update(payload).eq('id', itemId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb.from('warehouse_items').insert(payload)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/almacen')
}

export async function updateWarehouseStock(itemId: string, newStock: number) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb
    .from('warehouse_items')
    .update({ current_stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
  revalidatePath('/almacen')
}

export async function deleteWarehouseItem(itemId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb
    .from('warehouse_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
  revalidatePath('/almacen')
}
