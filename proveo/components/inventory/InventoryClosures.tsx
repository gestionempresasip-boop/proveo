'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  createInventoryClosure, listInventoryClosures, getInventoryClosureItems, deleteInventoryClosure,
  type ClosurePeriodType,
} from '@/app/actions/inventoryClosures'
import { FileSpreadsheet, Download, Trash2, Check, X, Euro } from 'lucide-react'

type Closure = {
  id: string
  period_type: ClosurePeriodType
  period_label: string
  date_from: string
  date_to: string
  total_items: number
  total_value: number
  created_at: string
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmtMoney(n: number) {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

// Genera y descarga el .xlsx del cierre pulsado, con las líneas de producto
// y una fila de total al final.
async function exportClosureToExcel(closure: Closure) {
  const items = await getInventoryClosureItems(closure.id)
  const XLSX = await import('xlsx')

  const rows = items.map((i: any) => ({
    Producto: i.product_name,
    Categoría: i.category_name ?? 'Sin categoría',
    Unidad: i.unit,
    Stock: Number(i.stock_qty),
    'Precio coste (€)': i.cost_price != null ? Number(i.cost_price) : '',
    'Valor total (€)': Number(i.line_value),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', 'TOTAL', closure.total_value]], { origin: -1 })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  const safeLabel = closure.period_label.replace(/[^\w-]+/g, '_')
  XLSX.writeFile(wb, `inventario_${safeLabel}.xlsx`)
}

function DeleteClosureButton({ closure, onDeleted }: { closure: Closure; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-700 whitespace-nowrap">¿Eliminar cierre?</span>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await deleteInventoryClosure(closure.id); onDeleted() })}
          className="p-1 rounded text-red-600 hover:bg-red-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-600 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} title="Eliminar cierre" className="p-1.5 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-50 transition-colors">
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

export function InventoryClosures({ isNave, organizationId }: { isNave: boolean; organizationId: string }) {
  const [closures, setClosures] = useState<Closure[] | null>(null)
  const [periodType, setPeriodType] = useState<ClosurePeriodType>('mes')
  const today = new Date().toISOString().slice(0, 10)
  const [dayValue, setDayValue] = useState(today)
  const [monthValue, setMonthValue] = useState(today.slice(0, 7))
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()))
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  function loadClosures() {
    startTransition(async () => {
      const data = await listInventoryClosures(organizationId)
      setClosures(data as Closure[])
    })
  }

  useEffect(() => { loadClosures() }, [organizationId])

  function computeRange(): { dateFrom: string; dateTo: string; label: string } | null {
    if (periodType === 'dia') {
      return { dateFrom: dayValue, dateTo: dayValue, label: fmtDate(dayValue) }
    }
    if (periodType === 'mes') {
      const [y, m] = monthValue.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      return {
        dateFrom: `${monthValue}-01`,
        dateTo: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
        label: `${MONTHS_ES[m - 1]} ${y}`,
      }
    }
    if (periodType === 'anual') {
      const y = Number(yearValue)
      if (!y) return null
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31`, label: String(y) }
    }
    // personalizado
    if (!customFrom || !customTo || customFrom > customTo) return null
    return { dateFrom: customFrom, dateTo: customTo, label: `${fmtDate(customFrom)} – ${fmtDate(customTo)}` }
  }

  const range = computeRange()

  function handleCreate() {
    if (!range) return
    setError(null)
    startTransition(async () => {
      try {
        await createInventoryClosure(periodType, range.label, range.dateFrom, range.dateTo, isNave, organizationId)
        loadClosures()
      } catch {
        setError('No se pudo generar el cierre de inventario, inténtalo de nuevo')
      }
    })
  }

  async function handleExport(closure: Closure) {
    setExportingId(closure.id)
    try {
      await exportClosureToExcel(closure)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-medium text-black">Nuevo cierre de inventario</p>
        <p className="text-xs text-gray-600">
          Guarda una foto del stock actual valorada al precio de coste. Elige qué periodo representa — no recalcula stock de fechas pasadas.
        </p>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([['dia', 'Día'], ['mes', 'Mes'], ['anual', 'Año'], ['personalizado', 'Personalizado']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriodType(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periodType === k ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
              }`}>{l}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {periodType === 'dia' && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={dayValue} onChange={e => setDayValue(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
          )}
          {periodType === 'mes' && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Mes</label>
              <input type="month" value={monthValue} onChange={e => setMonthValue(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
          )}
          {periodType === 'anual' && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Año</label>
              <input type="number" value={yearValue} onChange={e => setYearValue(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
          )}
          {periodType === 'personalizado' && (
            <>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Desde</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Hasta</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
            </>
          )}
          <button
            onClick={handleCreate}
            disabled={pending || !range}
            className="flex items-center gap-1.5 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] disabled:opacity-60 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {pending ? 'Generando...' : `Cerrar inventario de ${range?.label ?? '...'}`}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Euro className="w-4 h-4 text-[#1E2B28]" />
          <span className="font-semibold text-sm text-black">Cierres guardados</span>
        </div>
        {closures === null ? (
          <p className="text-center py-10 text-gray-600 text-sm">Cargando...</p>
        ) : closures.length === 0 ? (
          <p className="text-center py-10 text-gray-600 text-sm">Todavía no has hecho ningún cierre de inventario</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">Periodo</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">Generado</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-600 font-medium">Productos</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-600 font-medium">Valoración</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {closures.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-black capitalize">{c.period_label}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(c.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.total_items}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1E2B28]">{fmtMoney(c.total_value)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleExport(c)}
                        disabled={exportingId === c.id}
                        title="Exportar a Excel"
                        className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {exportingId === c.id ? 'Generando...' : 'Excel'}
                      </button>
                      <DeleteClosureButton closure={c} onDeleted={loadClosures} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
