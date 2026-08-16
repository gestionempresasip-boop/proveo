'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type OrderMessage = {
  id: string
  senderId: string
  senderName: string | null
  senderOrgType: 'nave' | 'restaurante'
  body: string
  createdAt: string
}

export async function listOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('order_messages')
    .select('id, sender_id, body, created_at, profiles(full_name, organizations(type))')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((m: any) => ({
    id: m.id, senderId: m.sender_id, senderName: m.profiles?.full_name ?? null,
    senderOrgType: m.profiles?.organizations?.type ?? 'nave',
    body: m.body, createdAt: m.created_at,
  }))
}

export async function sendOrderMessage(orderId: string, body: string) {
  if (!body.trim()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await (supabase as any).from('order_messages').insert({
    order_id: orderId, sender_id: user.id, body: body.trim(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/pedidos')
}
