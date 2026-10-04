'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { createCostItem, updateCostItem, toggleCostItemActive, deleteCostItem, type OrgCostItem } from '@/app/actions/orgCosts'
import { eur } from '@/lib/finance'
import { cn } from '@/lib/utils'

type Kind = 'fijo' | 'variable'
type Mode = 'monthly' | 'percent'

const KIND_LABEL: Record<Kind, string> = { fijo: 'Costes fijos', variable: 'Costes variables' }
const KIND_HELP: Record<Kind, string> = {
  fijo: 'Se pagan cada mes se venda lo que se venda: alquiler, nóminas, suministros, seguros…',
  variable: 'Suben o bajan con las ventas: comisiones, envases, transporte, mermas…',
}

function describe(i: { mode: Mode; value: number }) {
  return i.mode === 'percent' ? `${i.value.toLocaleString('es-ES')}% de las ventas` : `${eur(i.value, 2)} al mes`
}

export function CostItemsEditor({
  organizationId, items, allowedKinds, onItemsChange,
}: {
  organizationId: string
  items: OrgCostItem[]
  allowedKinds: Kind[]
  onItemsChange: (next: OrgCostItem[]) => void
}) {
  const [kind, setKind] = useState<Kind>(allowedKinds[0])
  const [mode, setMode] = useState<Mode>('monthly')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eMode, setEMode] = useState<Mode>('monthly')
  const [eValue, setEValue] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const mine = items.filter(i => i.organization_id === organizationId)
  const input = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2B28]'

  async function add() {
    if (!name.trim() || saving) return
    setSaving(true); setError(null)
    try {
      const created = await createCostItem({ organizationId, kind, mode, name: name.trim(), value: Number(value.replace(',', '.')) || 0 })
      onItemsChange([...items, created])
      setName(''); setValue('')
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(i: OrgCostItem) {
    setEditingId(i.id); setEName(i.name); setEMode(i.mode); setEValue(String(i.value))
  }

  async function saveEdit(i: OrgCostItem) {
    if (!eName.trim()) return
    const v = Number(eValue.replace(',', '.')) || 0
    try {
      await updateCostItem(i.id, { kind: i.kind, mode: eMode, name: eName.trim(), value: v })
      onItemsChange(items.map(x => x.id === i.id ? { ...x, name: eName.trim(), mode: eMode, value: v } : x))
      setEditingId(null)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar')
    }
  }

  async function toggle(i: OrgCostItem) {
    onItemsChange(items.map(x => x.id === i.id ? { ...x, active: !x.active } : x))
    try { await toggleCostItemActive(i.id, !i.active) } catch { onItemsChange(items) }
  }

  async function remove(i: OrgCostItem) {
    const prev = items
    onItemsChange(items.filter(x => x.id !== i.id))
    setConfirmId(null)
    try { await deleteCostItem(i.id) } catch { onItemsChange(prev); setError('No se pudo eliminar') }
  }

  return (
    <div className="space-y-4">
      {allowedKinds.map(k => {
        const list = mine.filter(i => i.kind === k)
        const monthly = list.filter(i => i.active && i.mode === 'monthly').reduce((s, i) => s + i.value, 0)
        const pctSum = list.filter(i => i.active && i.mode === 'percent').reduce((s, i) => s + i.value, 0)
        return (
          <div key={k} className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-black text-sm">{KIND_LABEL[k]}</p>
                <p className="text-xs text-gray-600">{KIND_HELP[k]}</p>
              </div>
              <p className="text-sm font-bold text-black">
                {eur(monthly, 0)}/mes{pctSum > 0 ? ` + ${pctSum.toLocaleString('es-ES')}% ventas` : ''}
              </p>
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-600">Todavía no hay ninguno.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {list.map(i => editingId === i.id ? (
                  <div key={i.id} className="px-4 py-3 flex flex-wrap items-center gap-2 bg-amber-50/40">
                    <input value={eName} onChange={e => setEName(e.target.value)} className={cn(input, 'flex-1 min-w-[140px]')} />
                    <select value={eMode} onChange={e => setEMode(e.target.value as Mode)} className={input}>
                      <option value="monthly">€ al mes</option>
                      <option value="percent">% de ventas</option>
                    </select>
                    <input value={eValue} onChange={e => setEValue(e.target.value)} inputMode="decimal" className={cn(input, 'w-28')} />
                    <button onClick={() => saveEdit(i)} className="flex items-center gap-1 text-sm font-semibold px-3 py-2.5 rounded-xl bg-[#1E2B28] text-white"><Check className="w-4 h-4" /> Guardar</button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700"><X className="w-4 h-4" /> Cancelar</button>
                  </div>
                ) : (
                  <div key={i.id} className={cn('px-4 py-3 flex flex-wrap items-center gap-3', !i.active && 'opacity-50')}>
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-medium text-black text-sm">{i.name}</p>
                      <p className="text-xs text-gray-600">{describe(i)}</p>
                    </div>
                    <button onClick={() => toggle(i)} className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border', i.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200')}>
                      {i.active ? 'Se cuenta' : 'No se cuenta'}
                    </button>
                    <button onClick={() => startEdit(i)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#1E2B28]/[0.07] text-[#1E2B28]"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                    {confirmId === i.id ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="text-red-600 font-medium">¿Eliminar?</span>
                        <button onClick={() => remove(i)} className="font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Sí</button>
                        <button onClick={() => setConfirmId(null)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmId(i.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl border border-dashed border-gray-300 p-4 space-y-3">
        <p className="text-sm font-semibold text-black flex items-center gap-1.5"><Plus className="w-4 h-4 text-[#A8793A]" /> Añadir un coste</p>
        <div className="flex flex-wrap gap-2">
          {allowedKinds.length > 1 && (
            <select value={kind} onChange={e => setKind(e.target.value as Kind)} className={input}>
              {allowedKinds.map(k => <option key={k} value={k}>{k === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
            </select>
          )}
          <input value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'fijo' ? 'Ej. Alquiler local' : 'Ej. Comisión tarjeta'} className={cn(input, 'flex-1 min-w-[160px]')} />
          <select value={mode} onChange={e => setMode(e.target.value as Mode)} className={input}>
            <option value="monthly">€ al mes</option>
            <option value="percent">% de ventas</option>
          </select>
          <input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" placeholder={mode === 'monthly' ? '€/mes' : '% ventas'} className={cn(input, 'w-28')} />
          <button onClick={add} disabled={saving || !name.trim()} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#A8793A] text-white hover:bg-[#8C6430] disabled:opacity-40">
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
