'use client'

import { useState, useTransition } from 'react'
import { getStockMovements, type StockMovement } from '@/app/actions/stockMovements'
import { ArrowUpCircle, ArrowDownCircle, History, Download } from 'lucide-react'

const REASON_OPTIONS = [
  { value: '', label: 'Todos los motivos' },
  { value: 'venta', label: 'Pedido / venta' },
  { value: 'entrada_manual', label: 'Entrada manual' },
  { value: 'merma', label: 'Merma' },
  { value: 'compra', label: 'Compra' },
  { value: 'produccion', label: 'Producción' },
  { value: 'consumo', label: 'Consumo' },
]

function exportCSV(rows: StockMovement[]) {
  const headers = ['Fecha', 'Producto', 'Cambio', 'Stock resultante', 'Motivo', 'Pedido', 'Quién', 'Notas']
  const csvRows = rows.map(m => [
    new Date(m.created_at).toLocaleString('es-ES'),
    m.product_name,
    `${m.delta >= 0 ? '+' : ''}${m.delta}`,
    m.resulting_stock ?? '',
    m.reason,
    m.order_number ? `#${m.order_number}` : '',
    m.created_by_name ?? '',
    m.notes ?? '',
  ])
  const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'movimientos-stock.csv'
  a.click()
}

export function MovementsTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reason, setReason] = useState('')
  const [movements, setMovements] = useState<StockMovement[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [searched, setSearched] = useState(false)

  function handleSearch() {
    setSearched(true)
    startTransition(async () => {
      const data = await getStockMovements({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, reason: reason || undefined })
      setMovements(data)
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-sm font-medium text-black mb-3">Filtrar movimientos</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Motivo</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
              {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={handleSearch} disabled={pending}
            className="bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] transition-colors disabled:opacity-60">
            {pending ? 'Cargando...' : 'Ver movimientos'}
          </button>
          {movements && movements.length > 0 && (
            <button onClick={() => exportCSV(movements)}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {!searched ? (
        <div className="text-center py-12 text-gray-600">
          <History className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p>Filtra por fecha o motivo y pulsa «Ver movimientos» — o pulsa directamente para ver los últimos 500</p>
        </div>
      ) : !movements || movements.length === 0 ? (
        <p className="text-center py-12 text-gray-600">Sin movimientos en ese rango</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
            {movements.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                {m.delta >= 0
                  ? <ArrowUpCircle className="w-4 h-4 text-green-600 shrink-0" />
                  : <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black truncate">{m.product_name}</p>
                  <p className="text-xs text-gray-600">
                    {m.reason}
                    {m.order_number ? ` · Pedido #${m.order_number}` : ''}
                    {m.created_by_name ? ` · ${m.created_by_name}` : ''}
                    {' · '}
                    {new Date(m.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {m.notes && <p className="text-xs text-gray-500 italic mt-0.5">{m.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold ${m.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.delta >= 0 ? '+' : ''}{m.delta}
                  </p>
                  {m.resulting_stock != null && <p className="text-xs text-gray-500">→ {m.resulting_stock}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
