import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { redirect } from 'next/navigation'
import { ProgramacionClient } from '@/components/production/ProgramacionClient'

export default async function ProgramacionPage() {
  const profile = await getAuthProfile()
  const canManage = profile.role === 'admin' || profile.role === 'nave_manager'
  if (!canManage) redirect('/dashboard')

  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: staff }, { data: recipes }, { data: tasks }] = await Promise.all([
    sb.from('profiles').select('id, full_name, role')
      .eq('organization_id', profile.organization_id)
      .in('role', ['cocinero', 'nave_manager'])
      .order('full_name'),
    sb.from('recipes').select('id, name, category')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('name'),
    sb.from('production_tasks')
      .select(`
        id, title, scheduled_date, notes, status, completed_at, created_at, recipe_id,
        profiles!production_tasks_assigned_to_fkey(full_name),
        production_task_ingredients(id, checked)
      `)
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <ProgramacionClient
      staff={staff ?? []}
      recipes={recipes ?? []}
      initialTasks={(tasks ?? []).map((t: any) => ({
        id: t.id, title: t.title, scheduledDate: t.scheduled_date, notes: t.notes,
        status: t.status, completedAt: t.completed_at, createdAt: t.created_at,
        recipeId: t.recipe_id, assignedName: t.profiles?.full_name ?? 'Sin nombre',
        ingredientsTotal: t.production_task_ingredients?.length ?? 0,
        ingredientsChecked: t.production_task_ingredients?.filter((i: any) => i.checked).length ?? 0,
      }))}
    />
  )
}
