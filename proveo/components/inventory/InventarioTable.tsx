'use client'

import { useState } from 'react'
import { upsertInventory } from '@/app/actions/inventory'
import { AlertTriangle, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp } from 'lucide-react'

type InventoryRow = {
  product_id: string
  product_name: string
  product_unit: string
  category_name: string | null
  current_stock: number
  min_stock: number
  last_updated: string | null
}

function StockStatus({ current, min }: { current: number; min: number }) {
  if (current === 0)
    return <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle className="w-3.5 h-3.5" />Sin stock</span>
  if (min > 0 && current <= min)
    return <span className="flex items-center gap-1 text-xs font-medium text-orange-500"><AlertTriangle className="w-3.5 h-3.5" />Stock bajo</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />OK</span>
}

function InventoryRow({
  row, isNave, organizationId,
}: {
  row: InventoryRow; isNave: boolean; organizationId: string
}) {
  const [stock, setStock] = useState(String(row.current_stock))
  const [min, setMin] = useState(String(row.min_stock))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = stock !== String(row.current_stock) || min !== String(row.min_stock)

  async function handleSave() {
    setSaving(true)
    await upsertInventory(
      row.product_id,
      parseFloat(stock) || 0,
      parseFloat(min) || 0,
      isNave,
      organizationId,
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentNum = parseFloat(stock) || 0
  const minNum = parseFloat(min) || 0
  const isLow = minNum > 0 && currentNum <= minNum
  const isEmpty = currentNum === 0

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isEmpty ? 'bg-red-50/20' : isLow ? 'bg-orange-50/20' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-[#1C1C1E] text-sm">{row.product_name}</p>
        {row.category_name && <p className="text-xs text-gray-400 mt-0.5">{row.category_name}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{row.product_unit}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="0.001"
            value={stock}
            onChange={e => { setStock(e.target.value); setSaved(false) }}
            className={`w-24 border rounded-lg px-2 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B4332] ${
              isEmpty ? 'border-red-300 text-red-600' : isLow ? 'border-orange-300 text-orange-600' : 'border-gray-200 text-[#1B4332]'
            }`}
          />
          <span className="text-xs text-gray-400">{row.product_unit}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="0.001"
            value={min}
            onChange={e => { setMin(e.target.value); setSaved(false) }}
            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
          />
          <span className="text-xs text-gray-400">{row.product_unit}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <StockStatus current={currentNum} min={minNum} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-300">
        {row.last_updated
          ? new Date(row.last_updated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {saved ? (
          <span className="text-xs text-green-600 font-medium">✓ Guardado</span>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              dirty
                ? 'bg-[#1B4332] text-white hover:bg-[#163828]'
                : 'text-gray-300 cursor-default'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </td>
    </tr>
  )
}

export function InventarioTable({
  rows, isNave, organizationId,
}: {
  rows: InventoryRow[]; isNave: boolean; organizationId: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'bajo' | 'sinstock'>('todos')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const filtered = rows.filter(r => {
    const matchSearch = r.product_name.toLowerCase().includes(search.toLowerCase())
    const stock = r.current_stock
    const min = r.min_stock
    if (filter === 'sinstock') return matchSearch && stock === 0
    if (filter === 'bajo') return matchSearch && min > 0 && stock <= min
    return matchSearch
  })

  // Agrupar por categoría
  const byCategory: Record<string, InventoryRow[]> = {}
  filtered.forEach(r => {
    const cat = r.category_name ?? 'Sin categoría'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(r)
  })

  const alertCount = rows.filter(r => r.min_stock > 0 && r.current_stock <= r.min_stock).length
  const emptyCount = rows.filter(r => r.current_stock === 0).length

  function toggleCategory(cat: string) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter('todos')}
          className={`rounded-xl p-4 text-left transition-all ${filter === 'todos' ? 'bg-[#1B4332] text-white' : 'bg-white border border-gray-100 hover:border-[#1B4332]'}`}
        >
          <p className={`text-2xl font-bold ${filter === 'todos' ? 'text-white' : 'text-[#1C1C1E]'}`}>{rows.length}</p>
          <p className={`text-xs mt-0.5 ${filter === 'todos' ? 'text-green-200' : 'text-gray-500'}`}>Total productos</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'bajo' ? 'todos' : 'bajo')}
          className={`rounded-xl p-4 text-left transition-all ${filter === 'bajo' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-100 hover:border-orange-400'}`}
        >
          <p className={`text-2xl font-bold ${filter === 'bajo' ? 'text-white' : alertCount > 0 ? 'text-orange-500' : 'text-[#1C1C1E]'}`}>{alertCount}</p>
          <p className={`text-xs mt-0.5 ${filter === 'bajo' ? 'text-orange-100' : 'text-gray-500'}`}>Stock bajo</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'sinstock' ? 'todos' : 'sinstock')}
          className={`rounded-xl p-4 text-left transition-all ${filter === 'sinstock' ? 'bg-red-500 text-white' : 'bg-white border border-gray-100 hover:border-red-400'}`}
        >
          <p className={`text-2xl font-bold ${filter === 'sinstock' ? 'text-white' : emptyCount > 0 ? 'text-red-600' : 'text-[#1C1C1E]'}`}>{emptyCount}</p>
          <p className={`text-xs mt-0.5 ${filter === 'sinstock' ? 'text-red-100' : 'text-gray-500'}`}>Sin stock</p>
        </button>
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
      />

      {/* Tabla agrupada por categoría */}
      {Object.entries(byCategory).map(([cat, catRows]) => {
        const isOpen = openCategories[cat] !== false // abierto por defecto
        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-sm text-[#1C1C1E]">{cat}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{catRows.length} productos</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Producto</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Ud.</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Stock actual</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Mínimo (alerta)</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Actualizado</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map(row => (
                    <InventoryRow key={row.product_id} row={row} isNave={isNave} organizationId={organizationId} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">No se encontraron productos</div>
      )}
    </div>
  )
}
