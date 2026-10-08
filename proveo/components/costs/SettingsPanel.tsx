'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { isPayrollTax, type CostSettings, type NaveCostItem, type Rates } from '@/lib/realCost'
import { saveCostSettings } from '@/app/actions/realCosts'
import { eur } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { field, label } from './ui'

export function SettingsPanel({
  items, settings, rates, extraItems, onSaved,
}: {
  items: NaveCostItem[]; settings: CostSettings; rates: Rates; extraItems: { name: string; value: number }[]
  onSaved: (s: CostSettings) => void
}) {
  const [draft, setDraft] = useState<CostSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wages = items.filter(i => i.active && i.category === 'personal' && !isPayrollTax(i))
  const tax = items.filter(i => i.active && isPayrollTax(i))
  const ticked = new Set(draft.labor_item_ids)
  const toggle = (id: string) => setDraft(d => ({ ...d, labor_item_ids: ticked.has(id) ? d.labor_item_ids.filter(x => x !== id) : [...d.labor_item_ids, id] }))

  async function save() {
    setSaving(true); setError(null)
    try { onSaved(await saveCostSettings(draft)) } catch (e) { setError(errorMessage(e, 'No se pudo guardar')) }
    setSaving(false)
  }

  return (
    <div className="border-t border-gray-100 pt-4 space-y-5">
      <div>
        <p className="font-semibold text-black text-sm">¿Quién trabaja en producción?</p>
        <p className="text-xs text-gray-600 mt-0.5">Marca a las personas que elaboran. Administración, limpieza y reparto cuentan como estructura de la nave.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {wages.map(w => (
            <label key={w.id} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer text-sm', ticked.has(w.id) ? 'border-[#1E2B28] bg-green-50' : 'border-gray-200 bg-white')}>
              <input type="checkbox" checked={ticked.has(w.id)} onChange={() => toggle(w.id)} className="w-4 h-4 accent-[#1E2B28]" />
              <span className="flex-1 min-w-0 truncate">{w.name}</span>
              <span className="text-xs text-gray-500 tabular-nums">{eur(w.monthly_amount)}</span>
            </label>
          ))}
        </div>
        {tax.length > 0 && (
          <p className="text-xs text-gray-600 mt-2 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {tax.map(t => `${t.name} (${eur(t.monthly_amount)})`).join(', ')} se reparte solo entre producción y estructura según lo que cobra cada grupo: a producción le tocan {eur(rates.payrollTaxShare)} al mes.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block"><span className={label}>Horas al mes por persona</span>
          <input type="number" min={1} step="any" value={draft.hours_per_person || ''} onChange={e => setDraft(d => ({ ...d, hours_per_person: Number(e.target.value) }))} className={cn(field, 'mt-1')} />
          <span className="text-[11px] text-gray-500">Una jornada completa son unas 160 h</span></label>
        <label className="block"><span className={label}>Rendimiento (%)</span>
          <input type="number" min={1} max={100} step="any" value={draft.efficiency_pct || ''} onChange={e => setDraft(d => ({ ...d, efficiency_pct: Number(e.target.value) }))} className={cn(field, 'mt-1')} />
          <span className="text-[11px] text-gray-500">Horas que se produce de verdad (sin pausas, limpieza, esperas). Suele ser 70–85%</span></label>
        <label className="block"><span className={label}>Costes indirectos (%)</span>
          <input type="number" min={0} max={100} step="any" value={draft.indirect_pct || ''} onChange={e => setDraft(d => ({ ...d, indirect_pct: Number(e.target.value) }))} className={cn(field, 'mt-1')} />
          <span className="text-[11px] text-gray-500">Se suma a cada producto (mermas generales, gestión, imprevistos)</span></label>
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-black text-sm">Estructura de la nave · {eur(rates.structureMonthly)} al mes</p>
          <Link href="/estadisticas" className="text-xs font-semibold text-[#1E2B28] underline">Editar costes fijos →</Link>
        </div>
        <ul className="mt-2 space-y-1">
          {rates.structureByCategory.map(c => (
            <li key={c.label} className="flex justify-between text-sm"><span className="text-gray-700">{c.label}</span><span className="tabular-nums text-gray-900">{eur(c.amount)}</span></li>
          ))}
        </ul>
        {extraItems.length > 0 && <p className="text-[11px] text-gray-500 mt-2">Incluye otros costes mensuales de Informes: {extraItems.map(e => e.name).join(', ')}.</p>}
        <p className="text-[11px] text-gray-500 mt-2">Aquí entra todo lo que no es un ingrediente: luz, agua, hipoteca, furgoneta (transporte), seguros… Si falta algo (desgaste de maquinaria, cámaras de frío), añádelo en Costes fijos con un importe mensual.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={save} disabled={saving} className="rounded-xl bg-[#A8793A] text-white font-semibold px-5 py-3 hover:bg-[#8F6630] disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar ajustes'}
      </button>
    </div>
  )
}
