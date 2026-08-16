'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChefHat, Clock, CircleCheck, CircleDashed, RefreshCw } from 'lucide-react'
import { createProductionTask, deleteProductionTask } from '@/app/actions/production'

type Staff = { id: string; full_name: string | null; role: string }
type Recipe = { id: string; name: string; category: string | null }
type Task = {
  id: string; title: string; scheduledDate: string; notes: string | null
  status: 'pendiente' | 'en_proceso' | 'completada'; completedAt: string | null; createdAt: string
  recipeId: string | null; assignedName: string; ingredientsTotal: number; ingredientsChecked: number
}

const STATUS_LABEL: Record<Task['status'], string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada' }
const STATUS_COLOR: Record<Task['status'], string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  en_proceso: 'bg-amber-100 text-amber-700',
  completada: 'bg-green-100 text-green-700',
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ProgramacionClient({ staff, recipes, initialTasks }: { staff: Staff[]; recipes: Recipe[]; initialTasks: Task[] }) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  useEffect(() => setTasks(initialTasks), [initialTasks])

  // Refresco automático: no hay Supabase Realtime en esta app todavía, así
  // que en vez de infraestructura nueva se pide al servidor los datos
  // frescos cada 12s — el admin ve el "completada" del cocinero sin recargar.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12000)
    return () => clearInterval(id)
  }, [router])

  const [recipeId, setRecipeId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRecipeChange(id: string) {
    setRecipeId(id)
    const r = recipes.find(x => x.id === id)
    if (r && !title) setTitle(r.name)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!assignedTo) { setError('Elige un cocinero'); return }
    if (!title.trim()) { setError('Falta el título de la producción'); return }
    startTransition(async () => {
      try {
        await createProductionTask({ recipeId: recipeId || null, assignedTo, title, scheduledDate, notes })
        setRecipeId(''); setAssignedTo(''); setTitle(''); setNotes(''); setScheduledDate(todayISO())
        router.refresh()
      } catch (e: any) {
        setError(e.message ?? 'No se pudo crear la producción')
      }
    })
  }

  function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      try { await deleteProductionTask(id) } catch { router.refresh() }
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Programación</h1>
          <p className="text-gray-700 mt-1 text-sm">Asigna producciones a cocina y sigue su estado</p>
        </div>
        <button onClick={() => router.refresh()} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-black">Nueva producción</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Receta (opcional)</label>
            <select value={recipeId} onChange={e => handleRecipeChange(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
              <option value="">Sin receta / producción libre</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}{r.category ? ` · ${r.category}` : ''}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Cocinero</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
              <option value="">Elige quién la hace</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? 'Sin nombre'}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Título de la producción</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Croquetas de jamón" className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Fecha</label>
            <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600">Notas (opcional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Instrucciones adicionales" className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-[#A8793A] hover:bg-[#8C6430] text-white disabled:opacity-50 transition-colors">
          <Plus className="w-4 h-4" /> Asignar producción
        </button>
      </form>

      {/* Tablero */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {tasks.length === 0 ? (
          <p className="text-center py-12 text-gray-600 text-sm">Todavía no hay producciones asignadas</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-[#1E2B28]/10 flex items-center justify-center shrink-0">
                  <ChefHat className="w-4 h-4 text-[#1E2B28]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-black truncate">{t.title}</p>
                  <p className="text-xs text-gray-600">
                    {t.assignedName} · {new Date(t.scheduledDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {t.ingredientsTotal > 0 && ` · ${t.ingredientsChecked}/${t.ingredientsTotal} ingredientes`}
                  </p>
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}>
                  {t.status === 'completada' ? <CircleCheck className="w-3 h-3" /> : t.status === 'en_proceso' ? <Clock className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
                  {STATUS_LABEL[t.status]}
                </span>
                <button onClick={() => handleDelete(t.id)} title="Eliminar" className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg shrink-0 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
