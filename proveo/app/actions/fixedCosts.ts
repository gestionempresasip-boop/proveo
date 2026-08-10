'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FixedCostCategory = 'personal' | 'suministros' | 'alquiler' | 'prestamos' | 'seguros' | 'otros'

export type FixedCost = {
  id: string
  category: FixedCostCategory
  name: string
  monthly_amount: number
  active: boolean
}

async function assertIsNaveOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await (supabase as any)
    .from('profiles').select('role, organizations(type)').eq('id', user.id).single()
  const isNave = profile?.role === 'admin' || profile?.organizations?.type === 'nave'
  if (!isNave) throw new Error('Sin permisos')
}

export async function createFixedCost(input: { category: FixedCostCategory; name: string; monthly_amount: number }) {
  await assertIsNaveOrAdmin()
  if (!input.name.trim()) throw new Error('Falta el nombre')
  if (!(input.monthly_amount >= 0)) throw new Error('Importe inválido')

  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('nave_fixed_costs')
    .insert({ category: input.category, name: input.name.trim(), monthly_amount: input.monthly_amount })
    .select('id, category, name, monthly_amount, active')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
  return data as FixedCost
}

export async function updateFixedCost(id: string, input: { category: FixedCostCategory; name: string; monthly_amount: number }) {
  await assertIsNaveOrAdmin()
  if (!input.name.trim()) throw new Error('Falta el nombre')
  if (!(input.monthly_amount >= 0)) throw new Error('Importe inválido')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('nave_fixed_costs')
    .update({ category: input.category, name: input.name.trim(), monthly_amount: input.monthly_amount, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}

export async function toggleFixedCostActive(id: string, active: boolean) {
  await assertIsNaveOrAdmin()
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('nave_fixed_costs')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}

export async function deleteFixedCost(id: string) {
  await assertIsNaveOrAdmin()
  const supabase = await createClient()
  const { error } = await (supabase as any).from('nave_fixed_costs').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estadisticas')
}
