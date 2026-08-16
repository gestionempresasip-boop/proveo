import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { redirect, notFound } from 'next/navigation'
import { TaskDetailClient } from '@/components/production/TaskDetailClient'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getAuthProfile()
  const canManage = profile.role === 'admin' || profile.role === 'nave_manager'
  if (profile.role !== 'cocinero' && !canManage) redirect('/dashboard')

  const supabase = await createClient()
  const sb = supabase as any

  const { data: task } = await sb
    .from('production_tasks')
    .select('id, title, scheduled_date, notes, status, assigned_to, recipe_id, profiles!production_tasks_assigned_to_fkey(full_name)')
    .eq('id', id)
    .single()
  if (!task) notFound()
  if (task.assigned_to !== profile.id && !canManage) redirect('/mi-produccion')

  const { data: ingredients } = await sb
    .from('production_task_ingredients')
    .select('id, product_id, name, quantity, unit, is_custom, checked')
    .eq('task_id', id)
    .order('is_custom')
    .order('name')

  let recipe: { name: string; category: string | null; servings: number; ingredients: { name: string; quantity: number; unit: string }[] } | null = null
  if (task.recipe_id) {
    const { data: r } = await sb
      .from('recipes')
      .select('name, category, servings, recipe_ingredients(quantity, unit, products(name))')
      .eq('id', task.recipe_id)
      .single()
    if (r) {
      recipe = {
        name: r.name, category: r.category, servings: r.servings,
        ingredients: (r.recipe_ingredients ?? []).map((i: any) => ({
          name: i.products?.name ?? 'Ingrediente', quantity: Number(i.quantity), unit: i.unit,
        })),
      }
    }
  }

  return (
    <TaskDetailClient
      task={{
        id: task.id, title: task.title, scheduledDate: task.scheduled_date, notes: task.notes,
        status: task.status, assignedName: task.profiles?.full_name ?? null,
      }}
      ingredients={(ingredients ?? []).map((i: any) => ({
        id: i.id, name: i.name, quantity: i.quantity != null ? Number(i.quantity) : null, unit: i.unit,
        isCustom: i.is_custom, checked: i.checked,
      }))}
      recipe={recipe}
      readOnly={task.assigned_to !== profile.id}
      backHref={canManage && task.assigned_to !== profile.id ? '/programacion' : '/mi-produccion'}
    />
  )
}
