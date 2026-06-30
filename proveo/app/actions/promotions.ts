'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
