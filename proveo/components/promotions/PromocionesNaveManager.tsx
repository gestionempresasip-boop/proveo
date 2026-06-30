'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, Trash2, Loader2, Package, Search, X, ChevronDown, ChevronUp, Plus, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertPromotion, removePromotion, createProductAndPromote } from '@/app/actions/promotions'

type SimpleProduct = { id: string; name: string; unit: string }
type PromoRow = {
  id: string
  product_id: string
  label: string
  notes: string | null
  expires_at: string | null
  created_at: string
  products: SimpleProduct | null
}

const LABEL_SUGGESTIONS = [
  'Caduca hoy',
  'Caduca pronto',
  'Últimas unidades',
  'Sugerencia del día',
  'Producto del día',
  'Oferta especial',
  'Perecedero',
  'Excedente de stock',
]

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']

const IVA_OPTIONS = [
  { label: '0 %',  value: 0 },
  { label: '4 %',  value: 0.04 },
  { label: '10 %', value: 0.10 },
  { label: '21 %', value: 0.21 },
]

function PromoFields({ label, setLabel, notes, setNotes, expiresAt, setExpiresAt, today }: {
  label: string; setLabel: (v: string) => void
  notes: string; setNotes: (v: string) => void
  expiresAt: string; setExpiresAt: (v: string) => void
  today: string
}) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Etiqueta para el restaurante *</label>
        <input
          list="label-suggestions"
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Ej: Caduca hoy, Sugerencia del día..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
        <datalist id="label-suggestions">
          {LABEL_SUGGESTIONS.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Descripción (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Aprovéchalo antes de que caduque..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Válido hasta (opcional)</label>
        <input
          type="date"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          min={today}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
        <p className="text-xs text-gray-500 mt-1">Sin fecha: activa indefinidamente.</p>
      </div>
    </>
  )
}

export function PromocionesNaveManager({
  promotions: initialPromos,
  availableProducts,
}: {
  promotions: PromoRow[]
  availableProducts: SimpleProduct[]
}) {
  const [promos, setPromos]       = useState<PromoRow[]>(initialPromos)
  const [available, setAvailable] = useState<SimpleProduct[]>(availableProducts)
  const [removing, setRemoving]   = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ── Flow 1: buscar producto existente ───────────────────────────────
  const [query, setQuery]                 = useState('')
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SimpleProduct | null>(null)
  const [label1, setLabel1]     = useState('')
  const [notes1, setNotes1]     = useState('')
  const [expires1, setExpires1] = useState('')
  const [saving1, setSaving1]   = useState(false)
  const [error1, setError1]     = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Flow 2: crear producto nuevo ─────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]     = useState('')
  const [newUnit, setNewUnit]     = useState('kg')
  const [newCost, setNewCost]     = useState('')
  const [newIva, setNewIva]       = useState(0.10)
  const [newMargin, setNewMargin] = useState('')
  const [label2, setLabel2]       = useState('')
  const [notes2, setNotes2]       = useState('')
  const [expires2, setExpires2]   = useState('')
  const [saving2, setSaving2]     = useState(false)
  const [error2, setError2]       = useState<string | null>(null)

  // Precio calculado en vivo para el formulario de creación
  const costNum   = parseFloat(newCost.replace(',', '.')) || 0
  const marginDec = parseFloat(newMargin.replace(',', '.')) / 100 || 0
  const priceNoIva    = costNum > 0 ? costNum * (1 + marginDec) : null
  const priceWithIva  = priceNoIva !== null ? priceNoIva * (1 + newIva) : null

  const filteredAvailable = available.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  // Cierra dropdown al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function selectProduct(p: SimpleProduct) {
    setSelectedProduct(p)
    setQuery(p.name)
    setDropdownOpen(false)
  }

  function clearSelection() {
    setSelectedProduct(null)
    setQuery('')
    setLabel1('')
    setNotes1('')
    setExpires1('')
    setError1(null)
  }

  async function handleAddExisting() {
    if (!selectedProduct || !label1.trim()) return
    setSaving1(true); setError1(null)
    try {
      await upsertPromotion(selectedProduct.id, label1.trim(), notes1 || null, expires1 || null)
      setPromos(prev => [{
        id: crypto.randomUUID(),
        product_id: selectedProduct.id,
        label: label1.trim(),
        notes: notes1 || null,
        expires_at: expires1 || null,
        created_at: new Date().toISOString(),
        products: selectedProduct,
      }, ...prev])
      setAvailable(prev => prev.filter(p => p.id !== selectedProduct.id))
      clearSelection()
    } catch {
      setError1('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSaving1(false)
    }
  }

  async function handleCreateAndPromote() {
    if (!newName.trim() || !newCost || !newMargin || !label2.trim()) return
    setSaving2(true); setError2(null)
    try {
      const result = await createProductAndPromote(
        {
          name: newName.trim(),
          unit: newUnit,
          cost_price: parseFloat(newCost.replace(',', '.')),
          iva_rate: newIva,
          margin: parseFloat(newMargin.replace(',', '.')) / 100,
        },
        { label: label2.trim(), notes: notes2 || null, expiresAt: expires2 || null },
      )
      setPromos(prev => [{
        id: crypto.randomUUID(),
        product_id: result.id,
        label: label2.trim(),
        notes: notes2 || null,
        expires_at: expires2 || null,
        created_at: new Date().toISOString(),
        products: result,
      }, ...prev])
      // El producto nuevo ya está en promoción, no aparece en available
      setNewName(''); setNewUnit('kg'); setNewCost(''); setNewIva(0.10); setNewMargin('')
      setLabel2(''); setNotes2(''); setExpires2('')
      setShowCreate(false)
    } catch (e: unknown) {
      setError2((e instanceof Error ? e.message : null) ?? 'Error al crear el producto.')
    } finally {
      setSaving2(false)
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id); setGlobalError(null)
    try {
      await removePromotion(id)
      const removed = promos.find(p => p.id === id)
      setPromos(prev => prev.filter(p => p.id !== id))
      if (removed?.products) {
        setAvailable(prev =>
          [...prev, removed.products!].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        )
      }
    } catch {
      setGlobalError('Error al eliminar la promoción.')
    } finally {
      setRemoving(null)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">

      {/* ── Flow 1: buscar producto existente ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-black text-base mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-[#A8793A]" />
          Añadir producto existente a promoción
        </h2>

        {available.length === 0 && promos.length > 0 ? (
          <p className="text-sm text-gray-600">Todos los productos activos ya tienen una promoción asignada.</p>
        ) : (
          <div className="space-y-3">
            {/* Buscador */}
            <div ref={searchRef} className="relative">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Buscar producto *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setDropdownOpen(true)
                    if (selectedProduct && e.target.value !== selectedProduct.name) {
                      setSelectedProduct(null)
                    }
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Escribe el nombre del producto..."
                  className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                />
                {query && (
                  <button
                    onClick={clearSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown de resultados */}
              {dropdownOpen && query && filteredAvailable.length > 0 && !selectedProduct && (
                <div className="absolute left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {filteredAvailable.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex-1 font-medium text-black">{p.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{p.unit}</span>
                    </button>
                  ))}
                  {available.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).length > 8 && (
                    <p className="text-xs text-gray-500 text-center py-2 border-t border-gray-100">
                      Escribe más para filtrar resultados
                    </p>
                  )}
                </div>
              )}

              {/* Sin resultados */}
              {dropdownOpen && query && filteredAvailable.length === 0 && !selectedProduct && (
                <div className="absolute left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                  <p className="text-sm text-gray-600">No encontrado entre los productos disponibles.</p>
                  <button
                    onMouseDown={e => { e.preventDefault(); setShowCreate(true); setNewName(query); setDropdownOpen(false) }}
                    className="text-sm text-[#A8793A] font-semibold hover:underline mt-1"
                  >
                    + Crear &ldquo;{query}&rdquo; como producto nuevo
                  </button>
                </div>
              )}
            </div>

            {/* Selección confirmada */}
            {selectedProduct && (
              <div className="flex items-center gap-2 bg-[#1E2B28]/5 rounded-xl px-3 py-2.5">
                <span className="text-sm font-semibold text-[#1E2B28] flex-1">{selectedProduct.name}</span>
                <span className="text-xs text-gray-600">{selectedProduct.unit}</span>
                <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 ml-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Campos de promo — solo cuando hay producto seleccionado */}
            {selectedProduct && (
              <>
                <PromoFields
                  label={label1} setLabel={setLabel1}
                  notes={notes1} setNotes={setNotes1}
                  expiresAt={expires1} setExpiresAt={setExpires1}
                  today={today}
                />
                {error1 && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error1}</p>
                )}
                <button
                  onClick={handleAddExisting}
                  disabled={!label1.trim() || saving1}
                  className="w-full bg-[#A8793A] hover:bg-[#8C6430] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving1 ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : 'Añadir a promociones'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Flow 2: crear producto nuevo ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCreate(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-black text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#A8793A]" />
            Crear producto nuevo y añadir a promoción
          </span>
          {showCreate
            ? <ChevronUp className="h-4 w-4 text-gray-500" />
            : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>

        {showCreate && (
          <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
            <div className="mt-4 space-y-3">
              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre del producto *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Lubina fresca, Cordero lechal..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                />
              </div>

              {/* Unidad */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Unidad *</label>
                <select
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] bg-white"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Coste + IVA + Margen en una fila */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Coste (€) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCost}
                    onChange={e => setNewCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">IVA *</label>
                  <select
                    value={newIva}
                    onChange={e => setNewIva(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] bg-white"
                  >
                    {IVA_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Margen (%) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newMargin}
                    onChange={e => setNewMargin(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Precio calculado */}
              {priceNoIva !== null && (
                <div className="flex items-center gap-2 bg-[#1E2B28]/5 rounded-xl px-4 py-3">
                  <Calculator className="h-4 w-4 text-[#1E2B28] shrink-0" />
                  <div className="text-sm">
                    <span className="text-gray-700">Precio sin IVA: </span>
                    <span className="font-semibold text-black">{priceNoIva.toFixed(2)} €</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-gray-700">Precio con IVA: </span>
                    <span className="font-bold text-[#1E2B28]">{priceWithIva!.toFixed(2)} €</span>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos de la promoción</p>
                <div className="space-y-3">
                  <PromoFields
                    label={label2} setLabel={setLabel2}
                    notes={notes2} setNotes={setNotes2}
                    expiresAt={expires2} setExpiresAt={setExpires2}
                    today={today}
                  />
                </div>
              </div>

              {error2 && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error2}</p>
              )}

              <button
                onClick={handleCreateAndPromote}
                disabled={!newName.trim() || !newCost || !newMargin || !label2.trim() || saving2}
                className="w-full bg-[#1E2B28] hover:bg-[#2d3f3b] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving2
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Creando...</>
                  : 'Crear producto y añadir a promociones'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lista de activas ────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold text-black text-base mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-600" />
          Activas ahora
          {promos.length > 0 && (
            <span className="ml-1 text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
              {promos.length}
            </span>
          )}
        </h2>

        {globalError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{globalError}</p>
        )}

        {promos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Sin promociones activas</p>
            <p className="text-sm text-gray-500 mt-1">
              Usa los formularios de arriba para destacar productos en el catálogo de los restaurantes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {promos.map(promo => (
              <div
                key={promo.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-black text-sm">{promo.products?.name ?? '—'}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                      {promo.label}
                    </span>
                  </div>
                  {promo.notes && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{promo.notes}</p>
                  )}
                  {promo.expires_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Válido hasta:{' '}
                      {new Date(promo.expires_at + 'T12:00:00').toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'long',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(promo.id)}
                  disabled={removing === promo.id}
                  title="Quitar de promociones"
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  {removing === promo.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
