'use client'

import { useState, useTransition, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, XCircle, Plus, X, Save, Search,
  PackageOpen, Pencil, Trash2, Check, ArrowUp, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertWarehouseItem, updateWarehouseStock, deleteWarehouseItem } from '@/app/actions/warehouse'

// ── Types ─────────────────────────────────────────────────────────────────────

type CatalogItem = {
  product_id: string
  product_name: string
  product_unit: string
  category_name: string | null
  category_color: string | null
  allows_box_order: boolean
  box_units: number | null
  current_stock: number
  min_stock: number
  last_updated: string | null
}

type Supply = {
  id: string
  name: string
  description: string | null
  unit: string
  current_stock: number
  min_stock: number
  supplier: string | null
  notes: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null
  updated_at: string | null
}

type WCat = { id: string; name: string; color: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function stockStatus(current: number, min: number) {
  if (current === 0) return 'empty'
  if (min > 0 && current <= min) return 'low'
  return 'ok'
}

function StockBadge({ current, min }: { current: number; min: number }) {
  const s = stockStatus(current, min)
  if (s === 'empty') return <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle className="w-3.5 h-3.5" />Sin stock</span>
  if (s === 'low')   return <span className="flex items-center gap-1 text-xs font-medium text-orange-500"><AlertTriangle className="w-3.5 h-3.5" />Bajo</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />OK</span>
}

const UNIT_SUGGESTIONS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja', 'rollo', 'bolsa', 'saco', 'palé', 'bote', 'sobre']

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryPanel({ catalogItems, supplies }: { catalogItems: CatalogItem[]; supplies: Supply[] }) {
  const catStats = useMemo(() => ({
    total:    catalogItems.length,
    empty:    catalogItems.filter(i => i.current_stock === 0).length,
    low:      catalogItems.filter(i => i.current_stock > 0 && i.min_stock > 0 && i.current_stock <= i.min_stock).length,
  }), [catalogItems])

  const supStats = useMemo(() => ({
    total:    supplies.length,
    empty:    supplies.filter(i => i.current_stock === 0).length,
    low:      supplies.filter(i => i.current_stock > 0 && i.min_stock > 0 && i.current_stock <= i.min_stock).length,
  }), [supplies])

  const totalAlerts = catStats.empty + catStats.low + supStats.empty + supStats.low

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Catálogo */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Productos catálogo</p>
        <p className="text-3xl font-bold text-[#1E2B28]">{catStats.total}</p>
        <div className="flex gap-3 mt-2">
          {catStats.empty > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <XCircle className="w-3 h-3" />{catStats.empty} sin stock
            </span>
          )}
          {catStats.low > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
              <AlertTriangle className="w-3 h-3" />{catStats.low} bajo mínimo
            </span>
          )}
          {catStats.empty === 0 && catStats.low === 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />Todo en orden
            </span>
          )}
        </div>
      </div>

      {/* Suministros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suministros propios</p>
        <p className="text-3xl font-bold text-[#1E2B28]">{supStats.total}</p>
        <div className="flex gap-3 mt-2">
          {supStats.empty > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <XCircle className="w-3 h-3" />{supStats.empty} sin stock
            </span>
          )}
          {supStats.low > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
              <AlertTriangle className="w-3 h-3" />{supStats.low} bajo mínimo
            </span>
          )}
          {supStats.total === 0 && (
            <span className="text-xs text-gray-400">Aún no hay artículos</span>
          )}
          {supStats.total > 0 && supStats.empty === 0 && supStats.low === 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />Todo en orden
            </span>
          )}
        </div>
      </div>

      {/* Alertas totales */}
      <div className={cn(
        'rounded-xl border p-4',
        totalAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
      )}>
        <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', totalAlerts > 0 ? 'text-red-500' : 'text-green-600')}>
          Alertas totales
        </p>
        <p className={cn('text-3xl font-bold', totalAlerts > 0 ? 'text-red-600' : 'text-green-600')}>{totalAlerts}</p>
        <p className={cn('text-xs mt-2', totalAlerts > 0 ? 'text-red-500' : 'text-green-600')}>
          {totalAlerts === 0 ? 'Sin alertas' : `${catStats.empty + catStats.low} catálogo · ${supStats.empty + supStats.low} suministros`}
        </p>
      </div>
    </div>
  )
}

// ── Catalog tab (read-only) ───────────────────────────────────────────────────

function CatalogTab({ items }: { items: CatalogItem[] }) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'todos' | 'bajo' | 'sinstock' | 'cajon'>('todos')
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i => {
      const matchQ = !q || i.product_name.toLowerCase().includes(q)
      if (!matchQ) return false
      if (filter === 'sinstock') return i.current_stock === 0
      if (filter === 'bajo')     return i.current_stock > 0 && i.min_stock > 0 && i.current_stock <= i.min_stock
      if (filter === 'cajon')    return i.allows_box_order
      return true
    })
  }, [items, search, filter])

  const grouped = useMemo(() => {
    const g: Record<string, { color: string | null; items: CatalogItem[] }> = {}
    for (const i of filtered) {
      const cat = i.category_name ?? 'Sin categoría'
      if (!g[cat]) g[cat] = { color: i.category_color, items: [] }
      g[cat].items.push(i)
    }
    return g
  }, [filtered])

  function toggle(cat: string) {
    setOpenCats(p => ({ ...p, [cat]: p[cat] === false ? true : false }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['todos', 'bajo', 'sinstock', 'cajon'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                filter === f ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-gray-800'
              )}
            >
              {f === 'todos' ? 'Todos' : f === 'bajo' ? 'Stock bajo' : f === 'sinstock' ? 'Sin stock' : 'Por cajón'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        Vista de solo lectura. Para editar el stock ve a
        <a href="/inventario" className="font-medium text-[#1E2B28] underline underline-offset-2">Inventario →</a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-gray-500 text-sm">Sin resultados</p>
      ) : (
        Object.entries(grouped).map(([cat, group]) => {
          const isOpen = openCats[cat] !== false
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggle(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold text-sm text-black">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color ?? '#9CA3AF' }} />
                  {cat}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{group.items.length}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {group.items.map(item => {
                    const stock = item.current_stock
                    const isEmpty = stock === 0
                    const isLow = !isEmpty && item.min_stock > 0 && stock <= item.min_stock
                    return (
                      <div key={item.product_id} className={cn('flex items-center gap-3 px-4 py-3', isEmpty ? 'bg-red-50/30' : isLow ? 'bg-orange-50/30' : '')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{item.product_name}</p>
                          {item.allows_box_order && item.box_units && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md mt-0.5">
                              <PackageOpen className="w-3 h-3" />Cajón ≈{item.box_units} und
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-semibold tabular-nums', isEmpty ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-[#1E2B28]')}>
                            {stock.toLocaleString('es-ES', { maximumFractionDigits: 3 })} {item.product_unit}
                          </p>
                          {item.allows_box_order && item.box_units && stock > 0 && (
                            <p className="text-[10px] text-blue-600">≈{Math.floor(stock / item.box_units)} caj.</p>
                          )}
                        </div>
                        <StockBadge current={stock} min={item.min_stock} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Supplies tab (CRUD) ───────────────────────────────────────────────────────

function SupplyModal({
  item, categories, organizationId, onClose,
}: {
  item: Supply | null
  categories: WCat[]
  organizationId: string
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await upsertWarehouseItem(fd, organizationId, item?.id)
        router.refresh()
        onClose()
      } catch {
        setError('No se pudo guardar, inténtalo de nuevo')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-6">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-black">{item ? 'Editar artículo' : 'Nuevo artículo'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Nombre *</label>
            <input
              name="name"
              defaultValue={item?.name}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              placeholder="Ej: Harina de trigo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Unidad *</label>
              <input
                name="unit"
                defaultValue={item?.unit ?? 'unidad'}
                required
                list="unit-suggestions"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                placeholder="kg, l, caja..."
              />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Categoría</label>
              <select
                name="category_id"
                defaultValue={item?.category_id ?? ''}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              >
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Stock actual</label>
              <input
                name="current_stock"
                type="number"
                min="0"
                step="0.001"
                defaultValue={item?.current_stock ?? 0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Mínimo (alerta)</label>
              <input
                name="min_stock"
                type="number"
                min="0"
                step="0.001"
                defaultValue={item?.min_stock ?? 0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Proveedor</label>
            <input
              name="supplier"
              defaultValue={item?.supplier ?? ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Descripción / Notas</label>
            <textarea
              name="description"
              defaultValue={item?.description ?? ''}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              placeholder="Opcional"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-[#1E2B28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#141F1C] disabled:opacity-60"
            >
              {pending ? 'Guardando...' : item ? 'Guardar cambios' : 'Añadir artículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SuppliesTab({ supplies: initialSupplies, categories, organizationId }: {
  supplies: Supply[]
  categories: WCat[]
  organizationId: string
}) {
  const [supplies, setSupplies] = useState(initialSupplies)
  useEffect(() => { setSupplies(initialSupplies) }, [initialSupplies])

  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('todas')
  const [modal, setModal]       = useState<Supply | 'new' | null>(null)
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
  const [savingId, setSavingId]  = useState<string | null>(null)
  const [savedIds, setSavedIds]  = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError]        = useState<string | null>(null)
  const [openCats, setOpenCats]  = useState<Record<string, boolean>>({})
  const router = useRouter()

  function stockVal(id: string, fallback: number) {
    return stockEdits[id] ?? String(fallback)
  }

  function isDirty(s: Supply) {
    const e = stockEdits[s.id]
    return e !== undefined && e !== String(s.current_stock)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return supplies.filter(s => {
      const matchQ   = !q || s.name.toLowerCase().includes(q) || (s.supplier?.toLowerCase().includes(q) ?? false)
      const matchCat = catFilter === 'todas' || s.category_id === catFilter || (catFilter === '__none__' && !s.category_id)
      return matchQ && matchCat
    })
  }, [supplies, search, catFilter])

  const grouped = useMemo(() => {
    const g: Record<string, { color: string | null; items: Supply[] }> = {}
    for (const s of filtered) {
      const cat = s.category_name ?? 'Sin categoría'
      if (!g[cat]) g[cat] = { color: s.category_color, items: [] }
      g[cat].items.push(s)
    }
    return g
  }, [filtered])

  async function saveStock(supply: Supply) {
    const newStock = parseFloat(stockVal(supply.id, supply.current_stock).replace(',', '.'))
    if (isNaN(newStock) || newStock < 0) return
    setSavingId(supply.id)
    setError(null)
    const prev = supply.current_stock
    setSupplies(ps => ps.map(s => s.id === supply.id ? { ...s, current_stock: newStock } : s))
    setStockEdits(e => { const n = { ...e }; delete n[supply.id]; return n })
    setSavedIds(p => new Set(p).add(supply.id))
    try {
      await updateWarehouseStock(supply.id, newStock)
      router.refresh()
    } catch {
      setSupplies(ps => ps.map(s => s.id === supply.id ? { ...s, current_stock: prev } : s))
      setStockEdits(e => ({ ...e, [supply.id]: String(newStock) }))
      setSavedIds(p => { const n = new Set(p); n.delete(supply.id); return n })
      setError(`No se pudo guardar "${supply.name}"`)
    } finally {
      setSavingId(null)
    }
    setTimeout(() => setSavedIds(p => { const n = new Set(p); n.delete(supply.id); return n }), 2000)
  }

  async function handleDelete(supply: Supply) {
    setDeletingId(supply.id)
    setError(null)
    try {
      await deleteWarehouseItem(supply.id)
      setSupplies(ps => ps.filter(s => s.id !== supply.id))
      router.refresh()
    } catch {
      setError(`No se pudo eliminar "${supply.name}"`)
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  function toggleCat(cat: string) {
    setOpenCats(p => ({ ...p, [cat]: p[cat] === false ? true : false }))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artículo o proveedor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] bg-white"
        >
          <option value="todas">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="__none__">Sin categoría</option>
        </select>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#141F1C] transition-colors"
        >
          <Plus className="w-4 h-4" />Añadir artículo
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>
      )}

      {supplies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 text-sm">Aún no hay artículos en el almacén.</p>
          <button
            onClick={() => setModal('new')}
            className="mt-3 text-[#1E2B28] text-sm font-medium underline underline-offset-2"
          >
            Añadir el primero
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-gray-500 text-sm">Sin resultados</p>
      ) : (
        Object.entries(grouped).map(([cat, group]) => {
          const isOpen = openCats[cat] !== false
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold text-sm text-black">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color ?? '#9CA3AF' }} />
                  {cat}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{group.items.length}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Artículo</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Stock actual</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Mínimo</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Estado</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(s => {
                        const stock = parseFloat(stockVal(s.id, s.current_stock)) || 0
                        const isEmpty = s.current_stock === 0
                        const isLow   = !isEmpty && s.min_stock > 0 && s.current_stock <= s.min_stock
                        const dirty   = isDirty(s)
                        const saving  = savingId === s.id
                        const saved   = savedIds.has(s.id)
                        const deleting = deletingId === s.id
                        const confirming = confirmDelete === s.id

                        return (
                          <tr key={s.id} className={cn('border-b border-gray-50 hover:bg-gray-50/50', isEmpty ? 'bg-red-50/20' : isLow ? 'bg-orange-50/20' : '')}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-black">{s.name}</p>
                              {s.supplier && <p className="text-xs text-gray-400 mt-0.5">{s.supplier}</p>}
                              {s.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{s.description}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={stockVal(s.id, s.current_stock)}
                                  onChange={e => setStockEdits(p => ({ ...p, [s.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveStock(s) }}
                                  className={cn(
                                    'w-24 border rounded-lg px-2 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E2B28]',
                                    isEmpty ? 'border-red-300 text-red-600' : isLow ? 'border-orange-300 text-orange-600' : 'border-gray-200 text-[#1E2B28]'
                                  )}
                                />
                                <span className="text-xs text-gray-500">{s.unit}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                              {s.min_stock > 0 ? `${s.min_stock} ${s.unit}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <StockBadge current={s.current_stock} min={s.min_stock} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {saved ? (
                                  <span className="text-xs text-green-600 font-medium">✓</span>
                                ) : dirty ? (
                                  <button
                                    onClick={() => saveStock(s)}
                                    disabled={saving}
                                    className="flex items-center gap-1 text-xs font-medium bg-[#1E2B28] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#141F1C] disabled:opacity-60"
                                  >
                                    <Save className="w-3 h-3" />
                                    {saving ? '...' : 'Guardar'}
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => setModal(s)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E2B28] hover:bg-gray-100 transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {confirming ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-600 whitespace-nowrap">¿Eliminar?</span>
                                    <button disabled={deleting} onClick={() => handleDelete(s)} className="p-1 rounded text-red-600 hover:bg-red-50">
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setConfirmDelete(null)} className="p-1 rounded text-gray-500 hover:bg-gray-100">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(s.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })
      )}

      {modal !== null && (
        <SupplyModal
          item={modal === 'new' ? null : modal}
          categories={categories}
          organizationId={organizationId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AlmacenClient({ catalogItems, supplies, warehouseCategories, organizationId }: {
  catalogItems: CatalogItem[]
  supplies: Supply[]
  warehouseCategories: WCat[]
  organizationId: string
}) {
  const [tab, setTab] = useState<'catalogo' | 'suministros'>('catalogo')

  const [showScrollTop, setShowScrollTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowScrollTop((window.scrollY || document.documentElement.scrollTop) > 300)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [])

  return (
    <div className="space-y-4">
      <SummaryPanel catalogItems={catalogItems} supplies={supplies} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('catalogo')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === 'catalogo' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-gray-800')}
        >
          Productos catálogo
          <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">{catalogItems.length}</span>
        </button>
        <button
          onClick={() => setTab('suministros')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === 'suministros' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-gray-800')}
        >
          Suministros propios
          <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">{supplies.length}</span>
        </button>
      </div>

      {tab === 'catalogo'
        ? <CatalogTab items={catalogItems} />
        : <SuppliesTab supplies={supplies} categories={warehouseCategories} organizationId={organizationId} />
      }

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Volver arriba"
          className="fixed bottom-[72px] md:bottom-6 right-4 md:right-6 z-40 w-11 h-11 rounded-full bg-[#1E2B28] text-white shadow-lg flex items-center justify-center active:scale-95 transition-all hover:bg-[#2a3d39]"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
