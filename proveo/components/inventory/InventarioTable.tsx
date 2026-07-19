'use client'

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { upsertInventory, getInventoryHistory, bulkSetMinStock, bulkUpsertInventory } from '@/app/actions/inventory'
import { softDeleteProduct, bulkSoftDeleteProducts } from '@/app/actions/products'
import { InventoryClosures } from './InventoryClosures'
import { BackupsPanel } from './BackupsPanel'
import { AlertTriangle, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp, History, Package, Download, ListChecks, X, Check, FileSpreadsheet, Trash2, Shield, ArrowUp } from 'lucide-react'

type InventoryRow = {
  product_id: string
  product_name: string
  product_unit: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  current_stock: number
  min_stock: number
  last_updated: string | null
}

type Category = { id: string; name: string; color: string | null }

type LogRow = {
  id: string
  product_name: string
  product_unit: string
  organization_name: string
  stock_value: number
  min_stock: number
  recorded_at: string
  notes: string | null
}

function StockStatus({ current, min }: { current: number; min: number }) {
  if (current === 0)
    return <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle className="w-3.5 h-3.5" />Sin stock</span>
  if (min > 0 && current <= min)
    return <span className="flex items-center gap-1 text-xs font-medium text-orange-500"><AlertTriangle className="w-3.5 h-3.5" />Stock bajo</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />OK</span>
}

// Botón de borrar producto con confirmación inline (mismo patrón que el de
// Gestión de Productos): un clic pide confirmar, el segundo clic borra.
function DeleteProductButton({ productName, deleting, onDelete }: { productName: string; deleting: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-700 whitespace-nowrap">¿Eliminar?</span>
        <button disabled={deleting} onClick={onDelete} className="p-1 rounded text-red-600 hover:bg-red-50">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-600 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} title={`Eliminar ${productName}`}
      className="p-1.5 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-50 transition-colors">
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

// Componente controlado: no guarda su propio estado, todo viene del padre.
// Así un guardado en masa (o el botón "Guardar todo") siempre se refleja al
// instante, sin depender de que el campo se "entere" de los nuevos props.
function InventoryRowItem({
  row, stockValue, minValue, dirty, saving, saved, isNave, deleting, onStockChange, onMinChange, onSave, onDelete,
}: {
  row: InventoryRow
  stockValue: string; minValue: string
  dirty: boolean; saving: boolean; saved: boolean; isNave: boolean; deleting: boolean
  onStockChange: (v: string) => void
  onMinChange: (v: string) => void
  onSave: () => void
  onDelete: () => void
}) {
  const currentNum = parseFloat(stockValue) || 0
  const minNum = parseFloat(minValue) || 0
  const isLow = minNum > 0 && currentNum <= minNum
  const isEmpty = currentNum === 0

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isEmpty ? 'bg-red-50/20' : isLow ? 'bg-orange-50/20' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-black text-sm">{row.product_name}</p>
        {row.category_name && <p className="text-xs text-gray-600 mt-0.5">{row.category_name}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">{row.product_unit}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="0.001"
            value={stockValue}
            onChange={e => onStockChange(e.target.value)}
            className={`w-24 border rounded-lg px-2 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E2B28] ${
              isEmpty ? 'border-red-300 text-red-600' : isLow ? 'border-orange-300 text-orange-600' : 'border-gray-200 text-[#1E2B28]'
            }`}
          />
          <span className="text-xs text-gray-600">{row.product_unit}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="0.001"
            value={minValue}
            onChange={e => onMinChange(e.target.value)}
            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
          />
          <span className="text-xs text-gray-600">{row.product_unit}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <StockStatus current={currentNum} min={minNum} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 hidden sm:table-cell">
        {row.last_updated
          ? new Date(row.last_updated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {saved ? (
            <span className="text-xs text-green-600 font-medium">✓ Guardado</span>
          ) : (
            <button
              onClick={onSave}
              disabled={saving || !dirty}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                dirty
                  ? 'bg-[#1E2B28] text-white hover:bg-[#141F1C]'
                  : 'text-gray-700 cursor-default'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {isNave && <DeleteProductButton productName={row.product_name} deleting={deleting} onDelete={onDelete} />}
        </div>
      </td>
    </tr>
  )
}

function exportCSV(logs: LogRow[], dateFrom: string, dateTo: string) {
  const header = 'Producto,Unidad,Organización,Stock,Mínimo,Fecha'
  const rows = logs.map(l => [
    `"${l.product_name}"`,
    l.product_unit,
    `"${l.organization_name}"`,
    l.stock_value,
    l.min_stock,
    new Date(l.recorded_at).toLocaleString('es-ES'),
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = dateFrom || dateTo ? `${dateFrom ?? ''}_${dateTo ?? ''}` : 'todo'
  a.download = `inventario_${label}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function HistorialTab({ organizationId }: { organizationId: string }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const [searched, setSearched] = useState(false)

  function handleSearch() {
    setSearched(true)
    startTransition(async () => {
      const data = await getInventoryHistory(organizationId, dateFrom || undefined, dateTo || undefined)
      setLogs(data as LogRow[])
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-sm font-medium text-black mb-3">Filtrar por fecha</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] transition-colors disabled:opacity-60"
          >
            {isPending ? 'Cargando...' : 'Ver historial'}
          </button>
          {logs && logs.length > 0 && (
            <button
              onClick={() => exportCSV(logs, dateFrom, dateTo)}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {!searched && (
        <div className="text-center py-12 text-gray-600">
          <History className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p>Selecciona un rango de fechas y pulsa «Ver historial»</p>
          <p className="text-xs mt-1">Cada vez que guardas un stock queda registrado aquí</p>
        </div>
      )}

      {searched && logs !== null && logs.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p>No hay registros para ese período</p>
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium">Producto</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium">Ud.</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-medium">Stock</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-medium">Mínimo</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium">Fecha y hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-black">{l.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{l.product_unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#1E2B28]">
                    {Number(l.stock_value).toLocaleString('es-ES', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {Number(l.min_stock).toLocaleString('es-ES', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {new Date(l.recorded_at).toLocaleString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-600">
            {logs.length} registros encontrados
          </div>
        </div>
      )}
    </div>
  )
}

// ── Asignar stock mínimo en masa ─────────────────────────────────────────────

function BulkMinStockModal({
  rows, categories, isNave, organizationId, onClose,
}: {
  rows: InventoryRow[]; categories: Category[]; isNave: boolean; organizationId: string; onClose: () => void
}) {
  const [scope, setScope] = useState<'todos' | 'categoria' | 'seleccion'>('todos')
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [selectedProds, setSelectedProds] = useState<Set<string>>(new Set())
  const [prodSearch, setProdSearch] = useState('')
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<number | null>(null)
  const router = useRouter()

  const targetIds = useMemo(() => {
    if (scope === 'todos') return rows.map(r => r.product_id)
    if (scope === 'categoria') return rows.filter(r => r.category_id && selectedCats.has(r.category_id)).map(r => r.product_id)
    return [...selectedProds]
  }, [scope, rows, selectedCats, selectedProds])

  const filteredRows = useMemo(() =>
    rows.filter(r => r.product_name.toLowerCase().includes(prodSearch.toLowerCase())),
    [rows, prodSearch]
  )

  function toggleCat(id: string) {
    setSelectedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleProd(id: string) {
    setSelectedProds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleApply() {
    const min = parseFloat(value.replace(',', '.'))
    if (isNaN(min) || min < 0 || targetIds.length === 0) return
    startTransition(async () => {
      const res = await bulkSetMinStock(targetIds, min, isNave, organizationId)
      setResult(res.updated)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-black flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#1E2B28]" /> Asignar stock mínimo en masa
          </h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs text-gray-700 font-medium block mb-1.5">¿A qué productos afecta?</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([['todos', 'Todos'], ['categoria', 'Por categoría'], ['seleccion', 'Selección manual']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setScope(k)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    scope === k ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {scope === 'categoria' && (
            <div className="border border-gray-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1">
              {categories.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedCats.has(c.id)} onChange={() => toggleCat(c.id)} className="accent-[#1E2B28]" />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color ?? '#9CA3AF' }} />
                  {c.name}
                </label>
              ))}
              {categories.length === 0 && <p className="text-xs text-gray-600 px-1">No hay categorías</p>}
            </div>
          )}

          {scope === 'seleccion' && (
            <div className="space-y-2">
              <input type="text" placeholder="Buscar producto..." value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              <div className="border border-gray-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1">
                {filteredRows.map(r => (
                  <label key={r.product_id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedProds.has(r.product_id)} onChange={() => toggleProd(r.product_id)} className="accent-[#1E2B28]" />
                    <span className="truncate">{r.product_name}</span>
                  </label>
                ))}
                {filteredRows.length === 0 && <p className="text-xs text-gray-600 px-1">Sin resultados</p>}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
            Afectará a <strong>{targetIds.length}</strong> producto{targetIds.length !== 1 ? 's' : ''}. El stock actual de cada uno no se modifica.
          </p>

          <div>
            <label className="text-xs text-gray-700 font-medium block mb-1.5">Stock mínimo a asignar</label>
            <input
              type="number" step="0.001" min="0" value={value} onChange={e => setValue(e.target.value)}
              placeholder="Ej: 5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
          </div>

          {result !== null && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" /> Mínimo asignado a {result} producto{result !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
            Cerrar
          </button>
          <button
            onClick={handleApply}
            disabled={pending || targetIds.length === 0 || value === ''}
            className="flex-1 bg-[#1E2B28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#141F1C] disabled:opacity-50"
          >
            {pending ? 'Aplicando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Borrar productos en masa ──────────────────────────────────────────────────

function BulkDeleteProductsModal({
  rows, categories, onClose, onDeleted,
}: {
  rows: InventoryRow[]; categories: Category[]; onClose: () => void; onDeleted: (deletedIds: string[]) => void
}) {
  const [scope, setScope] = useState<'todos' | 'categoria' | 'seleccion'>('seleccion')
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [selectedProds, setSelectedProds] = useState<Set<string>>(new Set())
  const [prodSearch, setProdSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirmStep, setConfirmStep] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetIds = useMemo(() => {
    if (scope === 'todos') return rows.map(r => r.product_id)
    if (scope === 'categoria') return rows.filter(r => r.category_id && selectedCats.has(r.category_id)).map(r => r.product_id)
    return [...selectedProds]
  }, [scope, rows, selectedCats, selectedProds])

  const filteredRows = useMemo(() =>
    rows.filter(r => r.product_name.toLowerCase().includes(prodSearch.toLowerCase())),
    [rows, prodSearch]
  )

  function toggleCat(id: string) {
    setSelectedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleProd(id: string) {
    setSelectedProds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleDelete() {
    if (targetIds.length === 0) return
    setError(null)
    startTransition(async () => {
      try {
        await bulkSoftDeleteProducts(targetIds)
        onDeleted(targetIds)
      } catch {
        setError('No se pudieron borrar los productos, inténtalo de nuevo')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-black flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" /> Borrar productos
          </h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-gray-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Los productos borrados desaparecen del catálogo, pedidos y stock. No se puede deshacer desde aquí.
          </p>

          <div>
            <label className="text-xs text-gray-700 font-medium block mb-1.5">¿Qué productos borrar?</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([['seleccion', 'Selección manual'], ['categoria', 'Por categoría'], ['todos', 'Todos']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setScope(k); setConfirmStep(false) }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    scope === k ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {scope === 'categoria' && (
            <div className="border border-gray-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1">
              {categories.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedCats.has(c.id)} onChange={() => { toggleCat(c.id); setConfirmStep(false) }} className="accent-[#1E2B28]" />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color ?? '#9CA3AF' }} />
                  {c.name}
                </label>
              ))}
              {categories.length === 0 && <p className="text-xs text-gray-600 px-1">No hay categorías</p>}
            </div>
          )}

          {scope === 'seleccion' && (
            <div className="space-y-2">
              <input type="text" placeholder="Buscar producto..." value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              <div className="border border-gray-200 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1">
                {filteredRows.map(r => (
                  <label key={r.product_id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedProds.has(r.product_id)} onChange={() => { toggleProd(r.product_id); setConfirmStep(false) }} className="accent-[#1E2B28]" />
                    <span className="truncate">{r.product_name}</span>
                  </label>
                ))}
                {filteredRows.length === 0 && <p className="text-xs text-gray-600 px-1">Sin resultados</p>}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
            Se borrarán <strong>{targetIds.length}</strong> producto{targetIds.length !== 1 ? 's' : ''}.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          {confirmStep ? (
            <button
              onClick={handleDelete}
              disabled={pending || targetIds.length === 0}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Borrando...' : `Sí, borrar ${targetIds.length}`}
            </button>
          ) : (
            <button
              onClick={() => setConfirmStep(true)}
              disabled={targetIds.length === 0}
              className="flex-1 bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
            >
              Borrar {targetIds.length} producto{targetIds.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function InventarioTable({
  rows: initialRows, categories, isNave, organizationId,
}: {
  rows: InventoryRow[]; categories: Category[]; isNave: boolean; organizationId: string
}) {
  const [rows, setRows] = useState(initialRows)
  // El modal "mínimo en masa" guarda y llama a router.refresh(); cuando el
  // servidor devuelve props frescas, se sincroniza el estado local con la
  // verdad confirmada (sin esto, el cambio en masa no se vería reflejado).
  useEffect(() => { setRows(initialRows) }, [initialRows])
  const [tab, setTab] = useState<'stock' | 'historial' | 'valorado' | 'backups'>('stock')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'bajo' | 'sinstock'>('todos')
  const [categoryFilter, setCategoryFilter] = useState<string>('todas')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [showBulkMin, setShowBulkMin] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [deletingRow, setDeletingRow] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { stock: string; min: string }>>({})
  const [savingAll, setSavingAll] = useState(false)
  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()

  const [showScrollTop, setShowScrollTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowScrollTop((window.scrollY || document.documentElement.scrollTop) > 300)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [])

  function getStockValue(row: InventoryRow) { return edits[row.product_id]?.stock ?? String(row.current_stock) }
  function getMinValue(row: InventoryRow) { return edits[row.product_id]?.min ?? String(row.min_stock) }
  function isDirty(row: InventoryRow) {
    const e = edits[row.product_id]
    return !!e && (e.stock !== String(row.current_stock) || e.min !== String(row.min_stock))
  }
  function setStockEdit(row: InventoryRow, value: string) {
    setEdits(prev => ({ ...prev, [row.product_id]: { stock: value, min: prev[row.product_id]?.min ?? String(row.min_stock) } }))
    setSavedRows(prev => { const n = new Set(prev); n.delete(row.product_id); return n })
  }
  function setMinEdit(row: InventoryRow, value: string) {
    setEdits(prev => ({ ...prev, [row.product_id]: { stock: prev[row.product_id]?.stock ?? String(row.current_stock), min: value } }))
    setSavedRows(prev => { const n = new Set(prev); n.delete(row.product_id); return n })
  }

  async function saveRow(row: InventoryRow) {
    const newStock = parseFloat(getStockValue(row)) || 0
    const newMin = parseFloat(getMinValue(row)) || 0
    const previous = row
    setSavingRow(row.product_id)
    setSaveError(null)
    // Optimista: refleja el cambio al instante, sin esperar al servidor
    setRows(prev => prev.map(r => r.product_id === row.product_id ? { ...r, current_stock: newStock, min_stock: newMin } : r))
    setSavedRows(prev => new Set(prev).add(row.product_id))
    setEdits(prev => { const n = { ...prev }; delete n[row.product_id]; return n })
    try {
      await upsertInventory(row.product_id, newStock, newMin, isNave, organizationId)
      router.refresh()
    } catch {
      setRows(prev => prev.map(r => r.product_id === row.product_id ? previous : r))
      setSavedRows(prev => { const n = new Set(prev); n.delete(row.product_id); return n })
      setEdits(prev => ({ ...prev, [row.product_id]: { stock: String(newStock), min: String(newMin) } }))
      setSaveError(`No se pudo guardar "${row.product_name}", inténtalo de nuevo`)
    } finally {
      setSavingRow(null)
    }
    setTimeout(() => setSavedRows(prev => { const n = new Set(prev); n.delete(row.product_id); return n }), 2000)
  }

  async function deleteRow(row: InventoryRow) {
    setDeletingRow(row.product_id)
    setSaveError(null)
    try {
      await softDeleteProduct(row.product_id)
      setRows(prev => prev.filter(r => r.product_id !== row.product_id))
      router.refresh()
    } catch {
      setSaveError(`No se pudo borrar "${row.product_name}", inténtalo de nuevo`)
    } finally {
      setDeletingRow(null)
    }
  }

  const dirtyRows = rows.filter(isDirty)

  async function saveAll() {
    if (dirtyRows.length === 0) return
    const updates = dirtyRows.map(row => ({
      productId: row.product_id,
      currentStock: parseFloat(getStockValue(row)) || 0,
      minStock: parseFloat(getMinValue(row)) || 0,
    }))
    const previousRows = rows
    setSavingAll(true)
    setSaveError(null)
    // Optimista: aplica todos los cambios al instante
    setRows(prev => prev.map(r => {
      const u = updates.find(u => u.productId === r.product_id)
      return u ? { ...r, current_stock: u.currentStock, min_stock: u.minStock } : r
    }))
    setEdits({})
    try {
      await bulkUpsertInventory(updates, isNave, organizationId)
      router.refresh()
    } catch {
      setRows(previousRows)
      setSaveError('No se pudo guardar todo, inténtalo de nuevo')
    } finally {
      setSavingAll(false)
    }
  }

  const filtered = rows.filter(r => {
    const matchSearch = r.product_name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'todas' || r.category_id === categoryFilter
      || (categoryFilter === '__none__' && !r.category_id)
    const stock = r.current_stock
    const min = r.min_stock
    if (!matchCategory) return false
    if (filter === 'sinstock') return matchSearch && stock === 0
    if (filter === 'bajo') return matchSearch && stock > 0 && min > 0 && stock <= min
    return matchSearch
  })

  const byCategory: Record<string, { rows: InventoryRow[]; color: string | null }> = {}
  filtered.forEach(r => {
    const cat = r.category_name ?? 'Sin categoría'
    if (!byCategory[cat]) byCategory[cat] = { rows: [], color: r.category_color }
    byCategory[cat].rows.push(r)
  })

  const alertCount = rows.filter(r => r.current_stock > 0 && r.min_stock > 0 && r.current_stock <= r.min_stock).length
  const emptyCount = rows.filter(r => r.current_stock === 0).length

  function toggleCategory(cat: string) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('stock')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'stock' ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
          }`}
        >
          Stock actual
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'historial' ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4" />
          Historial
        </button>
        <button
          onClick={() => setTab('valorado')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'valorado' ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Inventario valorado
        </button>
        {isNave && (
          <button
            onClick={() => setTab('backups')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'backups' ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Copias de seguridad
          </button>
        )}
      </div>

      {tab === 'historial' ? (
        <HistorialTab organizationId={organizationId} />
      ) : tab === 'valorado' ? (
        <InventoryClosures isNave={isNave} organizationId={organizationId} />
      ) : tab === 'backups' ? (
        <BackupsPanel />
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setFilter('todos')}
              className={`rounded-xl p-4 text-left transition-all ${filter === 'todos' ? 'bg-[#1E2B28] text-white' : 'bg-white border border-gray-100 hover:border-[#1E2B28]'}`}
            >
              <p className={`text-2xl font-bold ${filter === 'todos' ? 'text-white' : 'text-black'}`}>{rows.length}</p>
              <p className={`text-xs mt-0.5 ${filter === 'todos' ? 'text-green-200' : 'text-gray-700'}`}>Total productos</p>
            </button>
            <button
              onClick={() => setFilter(filter === 'bajo' ? 'todos' : 'bajo')}
              className={`rounded-xl p-4 text-left transition-all ${filter === 'bajo' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-100 hover:border-orange-400'}`}
            >
              <p className={`text-2xl font-bold ${filter === 'bajo' ? 'text-white' : alertCount > 0 ? 'text-orange-500' : 'text-black'}`}>{alertCount}</p>
              <p className={`text-xs mt-0.5 ${filter === 'bajo' ? 'text-orange-100' : 'text-gray-700'}`}>Stock bajo</p>
            </button>
            <button
              onClick={() => setFilter(filter === 'sinstock' ? 'todos' : 'sinstock')}
              className={`rounded-xl p-4 text-left transition-all ${filter === 'sinstock' ? 'bg-red-500 text-white' : 'bg-white border border-gray-100 hover:border-red-400'}`}
            >
              <p className={`text-2xl font-bold ${filter === 'sinstock' ? 'text-white' : emptyCount > 0 ? 'text-red-600' : 'text-black'}`}>{emptyCount}</p>
              <p className={`text-xs mt-0.5 ${filter === 'sinstock' ? 'text-red-100' : 'text-gray-700'}`}>Sin stock</p>
            </button>
          </div>

          {/* Buscador + acción masiva */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] shrink-0"
            >
              <option value="todas">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__none__">Sin categoría</option>
            </select>
            {isNave && (
              <button
                onClick={() => setShowBulkMin(true)}
                className="flex items-center justify-center gap-2 border border-[#1E2B28] text-[#1E2B28] text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-green-50 transition-colors shrink-0"
              >
                <ListChecks className="w-4 h-4" /> Mínimo en masa
              </button>
            )}
            {isNave && (
              <button
                onClick={() => setShowBulkDelete(true)}
                className="flex items-center justify-center gap-2 border border-red-200 text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" /> Borrar productos
              </button>
            )}
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
              {saveError}
            </div>
          )}

          {dirtyRows.length > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <span className="text-sm text-amber-700">
                {dirtyRows.length} producto{dirtyRows.length !== 1 ? 's' : ''} con cambios sin guardar
              </span>
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="flex items-center gap-1.5 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] disabled:opacity-60 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {savingAll ? 'Guardando...' : 'Guardar todo'}
              </button>
            </div>
          )}

          {showBulkMin && (
            <BulkMinStockModal
              rows={rows}
              categories={categories}
              isNave={isNave}
              organizationId={organizationId}
              onClose={() => setShowBulkMin(false)}
            />
          )}

          {showBulkDelete && (
            <BulkDeleteProductsModal
              rows={rows}
              categories={categories}
              onClose={() => setShowBulkDelete(false)}
              onDeleted={deletedIds => {
                setRows(prev => prev.filter(r => !deletedIds.includes(r.product_id)))
                setShowBulkDelete(false)
                router.refresh()
              }}
            />
          )}

          {/* Tabla agrupada por categoría */}
          {Object.entries(byCategory).map(([cat, group]) => {
            const isOpen = openCategories[cat] !== false
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 font-semibold text-sm text-black">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color ?? '#9CA3AF' }} />
                    {cat}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{group.rows.length} productos</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium">Producto</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium">Ud.</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium">Stock actual</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium">Mínimo (alerta)</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium">Estado</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-600 font-medium hidden sm:table-cell">Actualizado</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(row => (
                        <InventoryRowItem
                          key={row.product_id}
                          row={row}
                          stockValue={getStockValue(row)}
                          minValue={getMinValue(row)}
                          dirty={isDirty(row)}
                          saving={savingRow === row.product_id}
                          saved={savedRows.has(row.product_id)}
                          isNave={isNave}
                          deleting={deletingRow === row.product_id}
                          onStockChange={v => setStockEdit(row, v)}
                          onMinChange={v => setMinEdit(row, v)}
                          onSave={() => saveRow(row)}
                          onDelete={() => deleteRow(row)}
                        />
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-600">No se encontraron productos</div>
          )}
        </>
      )}

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Volver arriba"
          title="Volver arriba"
          className="fixed bottom-6 right-4 md:right-6 z-40 w-11 h-11 rounded-full bg-[#1E2B28] text-white shadow-lg flex items-center justify-center active:scale-95 transition-all hover:bg-[#2a3d39]"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
