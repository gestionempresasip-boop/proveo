'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Package, Plus, Trash2, X } from 'lucide-react'
import {
  computeExternal, computeSheet, DEFAULT_EXTERNAL, type CostSheet, type Extra, type Ingredient, type Rates,
} from '@/lib/realCost'
import { saveCostSheet, deleteCostSheet, applySheetToProduct } from '@/app/actions/realCosts'
import { eur, pct } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { emptyIngredient, field, label, QUICK_EXTRAS, type Product, type SavedSheet } from './ui'

export function SheetEditor({
  initial, rates, indirectPct, products, takenProductIds, onClose, onSaved, onDeleted,
}: {
  initial: CostSheet; rates: Rates; indirectPct: number; products: Product[]; takenProductIds: Set<string>
  onClose: () => void; onSaved: (s: SavedSheet) => void; onDeleted: (id: string) => void
}) {
  const [sheet, setSheet] = useState<CostSheet>(initial)
  const [busy, setBusy] = useState<null | 'save' | 'apply' | 'delete'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const result = useMemo(() => computeSheet(sheet, rates, indirectPct), [sheet, rates, indirectPct])
  // Materia prima: o ingrediente por ingrediente, o un único coste directo.
  const direct = sheet.ingredients.length === 1 && sheet.ingredients[0].kind === 'direct' ? sheet.ingredients[0] : null
  const savedIngredients = useRef<Ingredient[]>([])
  function switchRawMode(toDirect: boolean) {
    if (toDirect && !direct) {
      savedIngredients.current = sheet.ingredients
      // Se parte del coste que ya salía con los ingredientes, para no perder el dato.
      const current = Math.round(result.ingredients * 100) / 100
      set({ ingredients: [{ name: 'Materia prima', quantity: 1, unit: 'tanda', unit_price: current, waste_pct: 0, kind: 'direct', per: 'batch' }] })
    } else if (!toDirect && direct) {
      set({ ingredients: savedIngredients.current })
    }
  }
  function setDirect(patch: Partial<Ingredient>) { set({ ingredients: [{ ...sheet.ingredients[0], ...patch }] }) }
  const prod = sheet.product_id ? products.find(p => p.id === sheet.product_id) ?? null : null
  const ivaPct = Math.round((prod?.iva_rate ?? 0.1) * 100)
  const set = (patch: Partial<CostSheet>) => { setSheet(s => ({ ...s, ...patch })); setMsg(null) }

  function setIngredient(i: number, patch: Partial<Ingredient>) {
    set({ ingredients: sheet.ingredients.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  }
  // Si el ingrediente coincide con un producto del catálogo, se rellena su coste.
  function matchCatalog(i: number, name: string) {
    const p = products.find(x => x.name.toLowerCase() === name.trim().toLowerCase())
    if (!p) { setIngredient(i, { name, product_id: null }); return }
    setIngredient(i, { name: p.name, product_id: p.id, unit: p.unit, unit_price: p.cost_price > 0 ? p.cost_price : p.price })
  }
  function setExtra(i: number, patch: Partial<Extra>) { set({ extras: sheet.extras.map((x, k) => (k === i ? { ...x, ...patch } : x)) }) }

  async function save(): Promise<SavedSheet | null> {
    setBusy('save'); setMsg(null)
    try {
      const saved = await saveCostSheet(sheet)
      onSaved({ ...saved, yield_qty: Number(saved.yield_qty), people: Number(saved.people), minutes: Number(saved.minutes), markup_pct: Number(saved.markup_pct) } as SavedSheet)
      setSheet(prev => ({ ...prev, id: saved.id }))
      setMsg({ ok: true, text: 'Ficha guardada' })
      return saved as SavedSheet
    } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo guardar') }); return null } finally { setBusy(null) }
  }

  async function apply() {
    setConfirmApply(false)
    const saved = await save()
    if (!saved) return
    setBusy('apply')
    try {
      const r = await applySheetToProduct(saved.id)
      setMsg({ ok: true, text: `Aplicado al producto: coste ${eur(r.cost, 3)} · precio de venta ${eur(r.price, 3)} (sin IVA)` })
    } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo aplicar') }) } finally { setBusy(null) }
  }

  async function remove() {
    if (!sheet.id) return
    setBusy('delete')
    try { await deleteCostSheet(sheet.id); onDeleted(sheet.id) } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo eliminar') }); setBusy(null) }
  }

  const ext = { ...DEFAULT_EXTERNAL, ...(sheet.external ?? {}) }
  const setExt = (patch: Partial<typeof ext>) => set({ external: { ...ext, ...patch } })
  const extRes = computeExternal(sheet, result, indirectPct)

  const parts = [
    { label: direct ? 'Materia prima' : 'Ingredientes (con merma)', value: result.ingredients, color: 'bg-amber-500' },
    { label: 'Mano de obra', value: result.labor, color: 'bg-[#1E2B28]' },
    { label: 'Estructura de la nave', value: result.structure, color: 'bg-sky-600' },
    { label: 'Envasado, transporte y extras', value: result.extras, color: 'bg-violet-500' },
    { label: `Costes indirectos (${indirectPct}%)`, value: result.indirect, color: 'bg-gray-400' },
  ]
  const total = result.batchTotal || 1
  const unit = prod?.unit ?? 'unidad'

  return (
    <div className="space-y-5">
      <button onClick={onClose} className="text-sm text-gray-700 hover:text-black flex items-center gap-1.5">← Volver a costes reales</button>
      <h1 className="text-2xl font-bold text-black">{initial.id ? sheet.name || 'Ficha de coste' : 'Nueva ficha de coste'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5">
          {/* Producto */}
          <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="font-bold text-black flex items-center gap-2"><Package className="w-4 h-4" /> Producto</h2>
            <label className="block"><span className={label}>Producto del catálogo (opcional)</span>
              <select value={sheet.product_id ?? ''} onChange={e => {
                const p = products.find(x => x.id === e.target.value)
                set({ product_id: p?.id ?? null, name: sheet.name || p?.name || '' })
              }} className={cn(field, 'mt-1')}>
                <option value="">Sin vincular (solo calcular)</option>
                {products.map(p => <option key={p.id} value={p.id} disabled={takenProductIds.has(p.id)}>{p.name}{takenProductIds.has(p.id) ? ' (ya tiene ficha)' : ''}</option>)}
              </select>
              <span className="text-[11px] text-gray-500">Si lo vinculas, luego puedes aplicarle el coste y el precio con un botón.</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block"><span className={label}>Nombre</span>
                <input value={sheet.name} onChange={e => set({ name: e.target.value })} placeholder="Ej: Lasaña de pollo (ración)" className={cn(field, 'mt-1')} /></label>
              <label className="block"><span className={label}>Cuántas {unit === 'kg' ? 'kg' : 'unidades'} salen de cada tanda</span>
                <input type="number" min={0} step="any" value={sheet.yield_qty || ''} onChange={e => set({ yield_qty: Number(e.target.value) })} className={cn(field, 'mt-1')} />
                <span className="text-[11px] text-gray-500">El coste final es por {unit === 'kg' ? 'kg' : 'unidad'} del producto</span></label>
            </div>
          </section>

          {/* Trabajo */}
          <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="font-bold text-black">Tiempo de trabajo de la tanda</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={label}>Personas trabajando</span>
                <input type="number" min={0} step="any" value={sheet.people || ''} onChange={e => set({ people: Number(e.target.value) })} className={cn(field, 'mt-1')} /></label>
              <label className="block"><span className={label}>Minutos (cada una)</span>
                <input type="number" min={0} step="any" value={sheet.minutes || ''} onChange={e => set({ minutes: Number(e.target.value) })} className={cn(field, 'mt-1')} /></label>
            </div>
            <p className="text-xs text-gray-600">Total: <strong>{result.hours.toLocaleString('es-ES', { maximumFractionDigits: 2 })} h</strong> de trabajo × {eur(rates.laborRate + rates.structureRate, 2)}/h = {eur(result.labor + result.structure, 2)} (mano de obra {eur(result.labor, 2)} + estructura {eur(result.structure, 2)}). Cuenta todo: preparar, cocinar, envasar y limpiar.</p>
          </section>

          {/* Ingredientes */}
          <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-black">Materia prima</h2>
              {!direct && (
                <button onClick={() => set({ ingredients: [...sheet.ingredients, emptyIngredient()] })} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border-2 border-[#1E2B28] text-[#1E2B28] hover:bg-green-50"><Plus className="w-4 h-4" /> Añadir ingrediente</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              <button onClick={() => switchRawMode(false)} className={cn('rounded-lg py-2.5 text-sm font-semibold transition-colors', !direct ? 'bg-white text-black shadow-sm' : 'text-gray-600')}>Ingrediente por ingrediente</button>
              <button onClick={() => switchRawMode(true)} className={cn('rounded-lg py-2.5 text-sm font-semibold transition-colors', direct ? 'bg-white text-black shadow-sm' : 'text-gray-600')}>Ya sé el coste total</button>
            </div>
            {direct && (
              <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
                <p className="text-sm text-gray-700">Escribe lo que cuesta la materia prima, sin IVA, y el cálculo hace el resto.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block"><span className={label}>Coste de materia prima (€)</span>
                    <input type="number" min={0} step="any" value={direct.unit_price || ''} onChange={e => setDirect({ unit_price: Number(e.target.value) })} placeholder="0" className={cn(field, 'mt-1')} /></label>
                  <label className="block"><span className={label}>Ese coste es…</span>
                    <select value={direct.per ?? 'batch'} onChange={e => setDirect({ per: e.target.value as 'unit' | 'batch' })} className={cn(field, 'mt-1')}>
                      <option value="batch">de la tanda completa</option>
                      <option value="unit">por {unit === 'kg' ? 'kg' : 'unidad'}</option>
                    </select></label>
                </div>
                <p className="text-xs text-gray-600">Equivale a <strong>{eur(result.ingredients, 2)}</strong> la tanda y <strong>{eur(sheet.yield_qty > 0 ? result.ingredients / sheet.yield_qty : 0, 3)}</strong> por {unit === 'kg' ? 'kg' : 'unidad'}. Incluye ya las mermas.</p>
              </div>
            )}
            <datalist id="catalog-products">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
            {!direct && sheet.ingredients.length === 0 && <p className="text-sm text-gray-600">Añade cada ingrediente con la cantidad que lleva la tanda y su precio de compra (sin IVA). Si escribes el nombre de un producto del catálogo, trae su coste.</p>}
            <div className="space-y-3">
              {!direct && sheet.ingredients.map((ing, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input list="catalog-products" value={ing.name} onChange={e => matchCatalog(i, e.target.value)} placeholder="Ingrediente" className={field} />
                    <button onClick={() => set({ ingredients: sheet.ingredients.filter((_, k) => k !== i) })} className="p-2 text-gray-400 hover:text-red-500" aria-label="Quitar"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="block"><span className="text-[11px] text-gray-500">Cantidad</span>
                      <input type="number" min={0} step="any" value={ing.quantity || ''} onChange={e => setIngredient(i, { quantity: Number(e.target.value) })} className={field} /></label>
                    <label className="block"><span className="text-[11px] text-gray-500">Unidad</span>
                      <input value={ing.unit} onChange={e => setIngredient(i, { unit: e.target.value })} className={field} /></label>
                    <label className="block"><span className="text-[11px] text-gray-500">€ por unidad</span>
                      <input type="number" min={0} step="any" value={ing.unit_price || ''} onChange={e => setIngredient(i, { unit_price: Number(e.target.value) })} className={field} /></label>
                    <label className="block"><span className="text-[11px] text-gray-500">Merma %</span>
                      <input type="number" min={0} max={95} step="any" value={ing.waste_pct || ''} onChange={e => setIngredient(i, { waste_pct: Number(e.target.value) })} className={field} /></label>
                  </div>
                  <p className="text-xs text-gray-600 text-right">Coste: <strong>{eur(result.ingredientLines[i]?.cost ?? 0, 2)}</strong></p>
                </div>
              ))}
            </div>
            {!direct && sheet.ingredients.length > 0 && <p className="text-[11px] text-gray-500">Merma = lo que se pierde al limpiar o cocinar. Con 20% de merma, para tener lo que lleva la receta compras un 25% más.</p>}
          </section>

          {/* Extras */}
          <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="font-bold text-black">Envasado, transporte, almacenamiento y otros</h2>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EXTRAS.map(q => (
                <button key={q} onClick={() => set({ extras: [...sheet.extras, { name: q, amount: 0, per: 'unit' as const }] })}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#1E2B28] hover:bg-green-50">+ {q}</button>
              ))}
              <button onClick={() => set({ extras: [...sheet.extras, { name: '', amount: 0, per: 'unit' }] })} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-dashed border-gray-300 hover:border-[#1E2B28]">+ Otro</button>
            </div>
            <div className="space-y-2">
              {sheet.extras.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ex.name} onChange={e => setExtra(i, { name: e.target.value })} placeholder="Concepto" className={cn(field, 'flex-1 min-w-0')} />
                  <input type="number" min={0} step="any" value={ex.amount || ''} onChange={e => setExtra(i, { amount: Number(e.target.value) })} placeholder="0" className={cn(field, 'w-24')} />
                  <select value={ex.per} onChange={e => setExtra(i, { per: e.target.value as Extra['per'] })} className={cn(field, 'w-32')}>
                    <option value="unit">€ por {unit === 'kg' ? 'kg' : 'unidad'}</option>
                    <option value="batch">€ por tanda</option>
                  </select>
                  <button onClick={() => set({ extras: sheet.extras.filter((_, k) => k !== i) })} className="p-2 text-gray-400 hover:text-red-500" aria-label="Quitar"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">Ejemplo: bolsa de envasado 0,06 € por unidad; transporte 0,10 € por unidad; almacenamiento en frío 0,03 € por unidad.</p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <label className="block"><span className={label}>Notas</span>
              <textarea value={sheet.notes ?? ''} onChange={e => set({ notes: e.target.value })} rows={2} className={cn(field, 'mt-1')} placeholder="Opcional" /></label>
          </section>
        </div>

        {/* Resultado */}
        <aside className="lg:sticky lg:top-4 space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            <div>
              <p className={label}>Coste real por {unit === 'kg' ? 'kg' : 'unidad'}</p>
              <p className="text-3xl font-bold text-black tabular-nums mt-0.5">{eur(result.unitCost, 3)}</p>
              <p className="text-xs text-gray-500">Tanda completa: {eur(result.batchTotal, 2)}</p>
            </div>

            <div className="space-y-2.5">
              {parts.map(p => (
                <div key={p.label}>
                  <div className="flex justify-between text-xs"><span className="text-gray-700">{p.label}</span><span className="tabular-nums text-gray-900 font-medium">{eur(p.value, 2)} · {pct((p.value / total) * 100)}</span></div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1"><div className={cn('h-full rounded-full', p.color)} style={{ width: `${Math.min(100, (p.value / total) * 100)}%` }} /></div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-3">
              <div>
                <p className={label}>Cuánto quieres ganar sobre el coste</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {[20, 30, 40, 50, 60].map(m => (
                    <button key={m} onClick={() => set({ markup_pct: m })} className={cn('px-3 py-1.5 rounded-full text-sm font-semibold border', sheet.markup_pct === m ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200')}>{m}%</button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} step="any" value={sheet.markup_pct || ''} onChange={e => set({ markup_pct: Number(e.target.value) })} className={cn(field, 'w-20 text-right')} /><span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-3.5">
                <p className="text-[11px] uppercase font-semibold text-green-800">Precio de venta (sin IVA)</p>
                <p className="text-2xl font-bold text-[#1E2B28] tabular-nums">{eur(result.suggestedNet, 3)}</p>
                <p className="text-xs text-green-900 mt-0.5">Con IVA {ivaPct}%: <strong>{eur(result.suggestedGross(ivaPct), 2)}</strong> · ganas {eur(result.profitPerUnit, 3)} por {unit === 'kg' ? 'kg' : 'unidad'} ({pct(result.marginOnPricePct, 1)} del precio)</p>
              </div>
              <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-3.5 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={!!sheet.external} onChange={e => set({ external: e.target.checked ? { ...DEFAULT_EXTERNAL } : null })} className="w-4 h-4 accent-sky-700" />
                  <span className="font-bold text-sky-950 text-sm">Venta a distribuidores (fuera del grupo)</span>
                </label>
                {!sheet.external && <p className="text-xs text-sky-800">Márcalo si vas a comercializar este producto fuera. Aparecerá en el filtro «Vender a distribuidores».</p>}
                {sheet.external && (<>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="text-[11px] text-sky-900">Tu margen sobre el coste completo %</span>
                    <input type="number" min={0} step="any" value={ext.markup_pct || ''} onChange={e => setExt({ markup_pct: Number(e.target.value) })} className={field} /></label>
                  <label className="block"><span className="text-[11px] text-sky-900">Margen del distribuidor % (sobre su venta)</span>
                    <input type="number" min={0} max={90} step="any" value={ext.dist_margin_pct || ''} onChange={e => setExt({ dist_margin_pct: Number(e.target.value) })} className={field} /></label>
                </div>
                <label className="block"><span className="text-[11px] text-sky-900">PVP al público sin IVA (opcional, si ya lo conoces)</span>
                  <input type="number" min={0} step="any" value={ext.pvp || ''} onChange={e => setExt({ pvp: Number(e.target.value) })} placeholder="0" className={field} /></label>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-sky-900">Precio suelo (no vendas por debajo)</span><span className="font-semibold tabular-nums">{eur(extRes.floor, 3)}</span></div>
                  <div className="flex justify-between"><span className="text-sky-900">Coste completo</span><span className="font-semibold tabular-nums">{eur(extRes.full, 3)}</span></div>
                  <div className="flex justify-between border-t border-sky-200 pt-1.5"><span className="font-semibold text-sky-950">Tu precio al distribuidor</span><span className="font-bold text-lg tabular-nums text-sky-950">{eur(extRes.price, 3)}</span></div>
                  <div className="flex justify-between"><span className="text-sky-900">PVP al público que le deja su margen</span><span className="font-semibold tabular-nums">{eur(extRes.recommendedPvp, 3)}</span></div>
                  {extRes.maxPrice != null && (
                    <p className={cn('text-xs rounded-lg px-2.5 py-2', extRes.price <= extRes.maxPrice ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800')}>
                      Con ese PVP el distribuidor puede pagar como máximo <strong>{eur(extRes.maxPrice, 3)}</strong>. {extRes.price <= extRes.maxPrice ? `Tu precio cabe y él ganaría ${pct(extRes.distMarginReal ?? 0, 1)}.` : 'Tu precio no le cabe: baja tu margen o mira si el PVP aguanta más.'}
                    </p>
                  )}
                  <p className="text-[11px] text-sky-800">Ganas {eur(extRes.yourProfit, 3)} por {unit === 'kg' ? 'kg' : 'unidad'} sobre el coste completo. Por encima del suelo cada venta ayuda a pagar la nave.</p>
                </div>
                </>)}
              </div>
              {prod && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-700 space-y-0.5">
                  <p className="font-semibold text-black">Ahora mismo en el catálogo</p>
                  <p>Coste: {prod.cost_price > 0 ? eur(prod.cost_price, 3) : 'sin coste'} · Precio sin IVA: {eur(prod.price, 3)}</p>
                  {prod.cost_price > 0 && <p className={result.unitCost > prod.cost_price ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>El coste real es {result.unitCost > prod.cost_price ? 'MAYOR' : 'menor'} en {eur(Math.abs(result.unitCost - prod.cost_price), 3)} ({pct((Math.abs(result.unitCost - prod.cost_price) / prod.cost_price) * 100, 1)})</p>}
                </div>
              )}
            </div>
          </div>

          {msg && <p className={cn('text-sm rounded-xl px-3.5 py-3 flex items-start gap-2', msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>{msg.ok && <Check className="w-4 h-4 shrink-0 mt-0.5" />}{msg.text}</p>}

          <div className="space-y-2">
            <button onClick={save} disabled={busy !== null} className="w-full rounded-xl bg-[#1E2B28] text-white font-semibold py-3 hover:bg-[#141F1C] disabled:opacity-50">{busy === 'save' ? 'Guardando…' : 'Guardar ficha'}</button>
            {sheet.product_id && !confirmApply && (
              <button onClick={() => setConfirmApply(true)} disabled={busy !== null || result.unitCost <= 0} className="w-full rounded-xl bg-[#A8793A] text-white font-semibold py-3 hover:bg-[#8F6630] disabled:opacity-50">Aplicar coste y precio al producto</button>
            )}
            {confirmApply && prod && (
              <div className="rounded-xl border-2 border-[#A8793A] bg-amber-50 p-3.5 space-y-2">
                <p className="text-sm text-amber-950 font-medium">Esto cambia el producto <strong>{prod.name}</strong> en el catálogo:</p>
                <p className="text-xs text-amber-950">Coste: {prod.cost_price > 0 ? eur(prod.cost_price, 3) : '—'} → <strong>{eur(result.unitCost, 3)}</strong><br />Precio sin IVA: {eur(prod.price, 3)} → <strong>{eur(result.suggestedNet, 3)}</strong><br /><span className="font-semibold">Los restaurantes verán el precio nuevo.</span></p>
                <div className="flex gap-2">
                  <button onClick={apply} className="flex-1 rounded-lg bg-[#A8793A] text-white text-sm font-semibold py-2.5">Sí, aplicar</button>
                  <button onClick={() => setConfirmApply(false)} className="flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium py-2.5">Cancelar</button>
                </div>
              </div>
            )}
            {sheet.id && (
              confirmDelete ? (
                <div className="flex gap-2">
                  <button onClick={remove} className="flex-1 rounded-lg bg-red-600 text-white text-sm font-semibold py-2.5">Sí, eliminar ficha</button>
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium py-2.5">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-600 text-sm py-2.5 hover:text-red-600 hover:border-red-200"><Trash2 className="w-4 h-4" /> Eliminar ficha</button>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
