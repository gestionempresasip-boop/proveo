'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export type TaskIngredient = {
  id: string
  product_id: string | null
  name: string
  quantity: number | null
  unit: string | null
  is_custom: boolean
  checked: boolean
}

export type ProductionTask = {
  id: string
  recipe_id: string | null
  assigned_to: string
  title: string
  scheduled_date: string
  notes: string | null
  status: 'pendiente' | 'en_proceso' | 'completada'
  completed_at: string | null
  created_at: string
}

async function assertIsNaveManager() {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || profile.role === 'nave_manager'
  if (!ok) throw new Error('Sin permisos')
  return profile
}

// El admin elige una receta y un cocinero; los ingredientes de la ficha se
// copian de recipe_ingredients en ese momento (predefinidos), para que la
// ficha del cocinero no dependa de que la receta siga igual más adelante.
export async function createProductionTask(input: {
  recipeId: string | null
  assignedTo: string
  title: string
  scheduledDate: string
  notes: string
}) {
  const profile = await assertIsNaveManager()
  if (!input.title.trim()) throw new Error('Falta el título de la producción')
  if (!input.assignedTo) throw new Error('Falta asignar un cocinero')

  const supabase = await createClient()
  const sb = supabase as any

  const { data: task, error } = await sb
    .from('production_tasks')
    .insert({
      organization_id: profile.organization_id,
      recipe_id: input.recipeId || null,
      assigned_to: input.assignedTo,
      created_by: profile.id,
      title: input.title.trim(),
      scheduled_date: input.scheduledDate,
      notes: input.notes.trim() || null,
    })
    .select('id')
    .single()
  if (error || !task) throw new Error(error?.message ?? 'No se pudo crear la producción')

  if (input.recipeId) {
    const { data: ingredients } = await sb
      .from('recipe_ingredients')
      .select('product_id, quantity, unit, products(name)')
      .eq('recipe_id', input.recipeId)
    if (ingredients?.length) {
      await sb.from('production_task_ingredients').insert(
        ingredients.map((ing: any) => ({
          task_id: task.id,
          product_id: ing.product_id,
          name: ing.products?.name ?? 'Ingrediente',
          quantity: ing.quantity,
          unit: ing.unit,
          is_custom: false,
        }))
      )
    }
  }

  revalidatePath('/programacion')
  return task.id as string
}

export async function deleteProductionTask(taskId: string) {
  await assertIsNaveManager()
  const supabase = await createClient()
  const { error } = await (supabase as any).from('production_tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath('/programacion')
}

// El cocinero solo puede añadir ingredientes a SUS propias tareas — lo
// aplica RLS (prod_ingredients_update_own), esta función no repite el check.
export async function addCustomIngredient(taskId: string, name: string, quantity: string, unit: string) {
  if (!name.trim()) throw new Error('Falta el nombre del ingrediente')
  const supabase = await createClient()
  const { error } = await (supabase as any).from('production_task_ingredients').insert({
    task_id: taskId,
    name: name.trim(),
    quantity: quantity ? Number(quantity) : null,
    unit: unit.trim() || null,
    is_custom: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/mi-produccion')
  revalidatePath('/programacion')
}

export async function toggleIngredientChecked(ingredientId: string, checked: boolean) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('production_task_ingredients')
    .update({ checked })
    .eq('id', ingredientId)
  if (error) throw new Error(error.message)
  revalidatePath('/mi-produccion')
}

export async function removeIngredient(ingredientId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('production_task_ingredients').delete().eq('id', ingredientId)
  if (error) throw new Error(error.message)
  revalidatePath('/mi-produccion')
}

export async function setTaskStatus(taskId: string, status: 'pendiente' | 'en_proceso' | 'completada') {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('production_tasks')
    .update({
      status,
      completed_at: status === 'completada' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath('/mi-produccion')
  revalidatePath('/programacion')
}
