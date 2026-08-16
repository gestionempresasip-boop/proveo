'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Check, Plus, Trash2, ChevronDown, ChevronUp, BookOpen, ChefHat } from 'lucide-react'
import { toggleIngredientChecked, addCustomIngredient, removeIngredient, setTaskStatus } from '@/app/actions/production'

type Ingredient = { id: string; name: string; quantity: number | null; unit: string | null; isCustom: boolean; checked: boolean }
type Task = { id: string; title: string; scheduledDate: string; notes: string | null; status: 'pendiente' | 'en_proceso' | 'completada'; assignedName: string | null }
type Recipe = { name: string; category: string | null; servings: number; ingredients: { name: string; quantity: number; unit: string }[] } | null

export function TaskDetailClient({ task, ingredients: initialIngredients, recipe, readOnly, backHref }: {
  task: Task; ingredients: Ingredient[]; recipe: Recipe; readOnly: boolean; backHref: string
}) {
  const router = useRouter()
  const [ingredients, setIngredients] = useState(initialIngredients)
  const [status, setStatus] = useState(task.status)
  const [showRecipe, setShowRecipe] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [, startTransition] = useTransition()

  function toggle(ing: Ingredient) {
    if (readOnly) return
    const next = !ing.checked
    setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, checked: next } : i))
    startTransition(async () => {
      try { await toggleIngredientChecked(ing.id, next) } catch { router.refresh() }
    })
  }

  function handleAddIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const tempId = `temp-${Date.now()}`
    setIngredients(prev => [...prev, { id: tempId, name: newName.trim(), quantity: newQty ? Number(newQty) : null, unit: newUnit.trim() || null, isCustom: true, checked: false }])
    const name = newName.trim(), qty = newQty, unit = newUnit
    setNewName(''); setNewQty(''); setNewUnit(''); setShowAddForm(false)
    startTransition(async () => {
      try { await addCustomIngredient(task.id, name, qty, unit) } finally { router.refresh() }
    })
  }

  function handleRemove(ingId: string) {
    setIngredients(prev => prev.filter(i => i.id !== ingId))
    startTransition(async () => {
      try { await removeIngredient(ingId) } catch { router.refresh() }
    })
  }

  function advanceStatus() {
    const next = status === 'pendiente' ? 'en_proceso' : 'completada'
    setStatus(next)
    startTransition(async () => {
      try { await setTaskStatus(task.id, next) } catch { router.refresh() }
    })
  }

  function reopen() {
    setStatus('en_proceso')
    startTransition(async () => {
      try { await setTaskStatus(task.id, 'en_proceso') } catch { router.refresh() }
    })
  }

  const total = ingredients.length
  const checkedCount = ingredients.filter(i => i.checked).length

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 pb-28">
      <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 w-fit">
        <ChevronLeft className="w-4 h-4" /> Volver
      </Link>

      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-black">{task.title}</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {new Date(task.scheduledDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            status === 'completada' ? 'bg-green-100 text-green-700' : status === 'en_proceso' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {status === 'completada' ? 'Completada' : status === 'en_proceso' ? 'En proceso' : 'Pendiente'}
          </span>
        </div>
        {readOnly && task.assignedName && <p className="text-xs text-gray-500 mt-1">Asignada a {task.assignedName}</p>}
        {task.notes && <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 mt-3">{task.notes}</p>}
      </div>

      {/* Ficha de ingredientes */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-black">Ingredientes a usar</h2>
          {total > 0 && <span className="text-xs text-gray-600">{checkedCount}/{total}</span>}
        </div>
        {ingredients.length === 0 ? (
          <p className="text-center py-8 text-gray-600 text-sm">Sin ingredientes predefinidos todavía</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {ingredients.map(ing => (
              <div key={ing.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggle(ing)}
                  disabled={readOnly}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                    ing.checked ? 'bg-[#1E2B28] border-[#1E2B28]' : 'border-gray-300'
                  } ${readOnly ? 'opacity-60' : ''}`}
                >
                  {ing.checked && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${ing.checked ? 'text-gray-400 line-through' : 'text-black'}`}>{ing.name}</p>
                  {(ing.quantity != null || ing.unit) && (
                    <p className="text-xs text-gray-600">{ing.quantity ?? ''} {ing.unit ?? ''}</p>
                  )}
                </div>
                {ing.isCustom && (
                  <span className="text-[10px] text-gray-400 shrink-0">añadido</span>
                )}
                {ing.isCustom && !readOnly && (
                  <button onClick={() => handleRemove(ing.id)} className="text-gray-400 hover:text-red-500 p-1 rounded shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="border-t border-gray-100 p-3">
            {showAddForm ? (
              <form onSubmit={handleAddIngredient} className="flex flex-wrap items-center gap-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Ingrediente"
                  className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
                <input value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Cant." type="number"
                  className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
                <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unidad"
                  className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
                <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-lg bg-[#1E2B28] text-white hover:bg-[#141F1C] transition-colors">Añadir</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-sm text-gray-600 px-2">Cancelar</button>
              </form>
            ) : (
              <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 text-sm font-medium text-[#1E2B28] hover:underline">
                <Plus className="w-4 h-4" /> Añadir ingrediente nuevo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Receta — en la misma pantalla, desplegable */}
      {recipe && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button onClick={() => setShowRecipe(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-black">
              <BookOpen className="w-4 h-4 text-[#1E2B28]" /> Ver receta completa
            </span>
            {showRecipe ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
          </button>
          {showRecipe && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#d8f3dc] rounded-xl flex items-center justify-center shrink-0">
                  <ChefHat className="h-5 w-5 text-[#1E2B28]" />
                </div>
                <div>
                  <p className="font-semibold text-black text-sm">{recipe.name}</p>
                  <p className="text-xs text-gray-600">{recipe.category ? `${recipe.category} · ` : ''}{recipe.servings} ración{recipe.servings !== 1 ? 'es' : ''}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800">{ing.name}</span>
                    <span className="text-gray-600">{ing.quantity} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Acciones de estado */}
      {!readOnly && (
        <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 md:left-56 bg-white border-t border-gray-100 p-4 print:hidden">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {status === 'completada' ? (
              <button onClick={reopen} className="text-sm font-medium text-gray-600 hover:text-black transition-colors">
                Reabrir tarea
              </button>
            ) : (
              <button onClick={advanceStatus} className="flex-1 flex items-center justify-center gap-2 bg-[#A8793A] hover:bg-[#8C6430] text-white font-semibold py-3 rounded-xl transition-colors">
                <Check className="w-4 h-4" />
                {status === 'pendiente' ? 'Empezar producción' : 'Marcar como terminada'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
