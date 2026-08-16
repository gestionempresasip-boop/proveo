import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChefHat, CircleCheck, Clock, CircleDashed } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada' }
const STATUS_COLOR: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  en_proceso: 'bg-amber-100 text-amber-700',
  completada: 'bg-green-100 text-green-700',
}
const STATUS_ICON: Record<string, typeof CircleCheck> = { pendiente: CircleDashed, en_proceso: Clock, completada: CircleCheck }

export default async function MiProduccionPage() {
  const profile = await getAuthProfile()
  if (profile.role !== 'cocinero') redirect('/dashboard')

  const supabase = await createClient()
  const sb = supabase as any

  const { data: tasks } = await sb
    .from('production_tasks')
    .select('id, title, scheduled_date, status, production_task_ingredients(id, checked)')
    .eq('assigned_to', profile.id)
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true })

  type ListedTask = { id: string; title: string; scheduledDate: string; status: string; total: number; checked: number }
  const list: ListedTask[] = (tasks ?? []).map((t: any) => ({
    id: t.id, title: t.title, scheduledDate: t.scheduled_date, status: t.status,
    total: t.production_task_ingredients?.length ?? 0,
    checked: t.production_task_ingredients?.filter((i: any) => i.checked).length ?? 0,
  }))
  const pending = list.filter((t: { status: string }) => t.status !== 'completada')
  const done = list.filter((t: { status: string }) => t.status === 'completada')

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Mi producción</h1>
        <p className="text-gray-700 mt-1 text-sm">{profile.full_name ?? 'Tus tareas asignadas'}</p>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <ChefHat className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No tienes producciones asignadas todavía</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Pendientes</h2>
              {pending.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Completadas</h2>
              {done.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: { id: string; title: string; scheduledDate: string; status: string; total: number; checked: number } }) {
  const Icon = STATUS_ICON[task.status] ?? CircleDashed
  return (
    <Link href={`/mi-produccion/${task.id}`} prefetch={false}>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.99]">
        <div className="w-10 h-10 rounded-full bg-[#1E2B28]/10 flex items-center justify-center shrink-0">
          <ChefHat className="w-4.5 h-4.5 text-[#1E2B28]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-black truncate">{task.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            {new Date(task.scheduledDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            {task.total > 0 && ` · ${task.checked}/${task.total} ingredientes`}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[task.status]}`}>
          <Icon className="w-3 h-3" /> {STATUS_LABEL[task.status]}
        </span>
      </div>
    </Link>
  )
}
