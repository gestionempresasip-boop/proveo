'use client'

import { useState, useTransition, useMemo } from 'react'
import { Package, Pencil, Trash2, Eye, EyeOff, Plus, X, Check, ChevronDown, ChevronRight, Sparkles, Tag, Euro, Search } from 'lucide-react'
import {
  toggleProductActive, softDeleteProduct, updateProduct, createProduct,
  createCategory, deleteCategory, updateCategory, seedDefaultCategories,
} from '@/app/actions/products'

// ── Types ────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; color: string | null; order_index: number | null }
type Product = {
  id: string; name: string; description: string | null
  price: number; unit: string
  min_order_quantity: number; order_increment: number
  is_active: boolean; category_id: string | null
  image_url?: string | null
  cost_price?: number | null
  iva_rate?: number | null
  margin?: number | null
  product_categories: { name: string } | null
}

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']
const IVA_OPTIONS = [
  { value: 4,  label: '4% — Alimentos básicos' },
  { value: 10, label: '10% — Alimentos / hostelería' },
  { value: 21, label: '21% — Alcohol y otros' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function catColor(color: string | null) { return color ?? '#6B7280' }

function ColorDot({ color }: { color: string | null }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(color) }} />
}

function finalPrice(p: Product) {
  const iva = Number(p.iva_rate) || 0
  return Number(p.price) * (1 + iva)
}

// ── Toggle active ─────────────────────────────────────────────────────────────

function ToggleActiveButton({ product }: { product: Product }) {
  const [active, setActive] = useState(product.is_active)
  const [pending, startTransition] = useTransition()
  function toggle() {
    startTransition(async () => { setActive(prev => !prev); await toggleProductActive(product.id, active) })
  }
  return (
    <button onClick={toggle} disabled={pending} title={active ? 'Ocultar a restaurantes' : 'Hacer visible'}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
        active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
               : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
      }`}>
      {active ? <><Eye className="w-3 h-3" />Visible</> : <><EyeOff className="w-3 h-3" />Oculto</>}
    </button>
  )
}

// ── Delete ────────────────────────────────────────────────────────────────────

function DeleteButton({ product }: { product: Product }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  function doDelete() { startTransition(async () => { await softDeleteProduct(product.id) }) }
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 whitespace-nowrap">¿Eliminar?</span>
        <button onClick={doDelete} disabled={pending} className="p-1 rounded text-red-600 hover:bg-red-50"><Check className="w-4 h-4" /></button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} title={`Eliminar ${product.name}`}
      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

// ── Pricing calculator (nave/admin only) ──────────────────────────────────────

function PricingCalculator({
  cost_price: initCost = 0,
  margin: initMargin = 0,      // stored as decimal 0–n, e.g. 0.25 = 25%
  iva_rate: initIva = 0.10,    // stored as decimal 0–1, e.g. 0.10 = 10%
  fallbackPrice = 0,
}: {
  cost_price?: number | null
  margin?: number | null
  iva_rate?: number | null
  fallbackPrice?: number
}) {
  const [cost, setCost]     = useState(Number(initCost)   || 0)
  const [margin, setMargin] = useState(Math.round((Number(initMargin) || 0) * 100))  // as %
  const [ivaPct, setIvaPct] = useState(Math.round((Number(initIva)   || 0.10) * 100)) // as %

  const priceNoIva  = cost > 0 ? cost * (1 + margin / 100) : (fallbackPrice || 0)
  const ivaAmount   = priceNoIva * (ivaPct / 100)
  const priceConIva = priceNoIva + ivaAmount

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Euro className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
          Precios — solo visible en la nave
        </span>
      </div>

      {/* Hidden inputs for the form */}
      <input type="hidden" name="cost_price"     value={cost} />
      <input type="hidden" name="margin"          value={(margin / 100).toFixed(6)} />
      <input type="hidden" name="iva_rate"        value={(ivaPct / 100).toFixed(6)} />
      {/* price_override drives the final price saved to DB */}
      <input type="hidden" name="price_override"  value={priceNoIva > 0 ? priceNoIva.toFixed(6) : ''} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Precio de coste (€)</label>
          <input
            type="number" step="0.0001" min="0"
            value={cost || ''}
            onChange={e => setCost(Number(e.target.value) || 0)}
            placeholder="0.0000"
            className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Margen (%)</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" step="1" min="0" max="2000"
              value={margin}
              onChange={e => setMargin(Number(e.target.value) || 0)}
              className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-sm text-amber-700 font-medium shrink-0">%</span>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">IVA aplicable</label>
        <select
          value={ivaPct}
          onChange={e => setIvaPct(Number(e.target.value))}
          className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {IVA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Calculated breakdown */}
      <div className="bg-white rounded-lg p-3 border border-amber-100 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Precio venta <span className="text-xs text-gray-400">(sin IVA)</span></span>
          <span className="font-semibold text-[#1C1C1E] tabular-nums">{priceNoIva.toFixed(4)} €</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 tabular-nums">
          <span>+ IVA {ivaPct}%</span>
          <span>+ {ivaAmount.toFixed(4)} €</span>
        </div>
        <div className="flex justify-between items-baseline border-t border-amber-100 pt-1.5">
          <span className="text-sm font-semibold text-[#1C1C1E]">Precio final (con IVA)</span>
          <span className="text-xl font-bold text-[#1E2B28] tabular-nums">{priceConIva.toFixed(2)} €</span>
        </div>
        <p className="text-xs text-gray-400 pt-0.5">Este es el precio que verán los restaurantes</p>
      </div>
    </div>
  )
}

// ── Product form fields ───────────────────────────────────────────────────────

function ProductFields({
  product,
  categories,
  isNave,
}: {
  product?: Product
  categories: Category[]
  isNave?: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
        <input name="name" defaultValue={product?.name} required placeholder="Ej: Aceite de oliva virgen"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
        <input name="description" defaultValue={product?.description ?? ''} placeholder="Opcional"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">URL de imagen</label>
        <input name="image_url" type="url" defaultValue={product?.image_url ?? ''} placeholder="https://... (pega una URL de imagen)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
        <select name="category_id" defaultValue={product?.category_id ?? ''}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
          <option value="">Sin categoría</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* When isNave the price is driven by the PricingCalculator via price_override.
            We still render it for fallback (cost=0 case) but it's labeled clearly. */}
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">
            {isNave ? 'Precio sin IVA (€) — anulado por coste+margen si > 0' : 'Precio (€) *'}
          </label>
          <input name="price" type="number" step="0.0001" min="0"
            defaultValue={product?.price ?? 0}
            required={!isNave}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] ${
              isNave ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200'
            }`} />
          {isNave && <p className="text-xs text-gray-400 mt-0.5">Se calcula automáticamente arriba</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
          <select name="unit" defaultValue={product?.unit ?? 'kg'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Cant. mínima</label>
          <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue={product?.min_order_quantity ?? 1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
          <input name="order_increment" type="number" step="0.001" min="0" defaultValue={product?.order_increment ?? 1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  product, categories, isNave, onClose,
}: {
  product: Product; categories: Category[]; isNave?: boolean; onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await updateProduct(product.id, fd); setDone(true); setTimeout(onClose, 600) })
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Editar producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {isNave && (
            <PricingCalculator
              cost_price={product.cost_price}
              margin={product.margin}
              iva_rate={product.iva_rate}
              fallbackPrice={product.price}
            />
          )}
          <ProductFields product={product} categories={categories} isNave={isNave} />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={pending || done} className="flex-1 bg-[#1E2B28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#141F1C] disabled:opacity-60">
              {done ? '✓ Guardado' : pending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New product modal ─────────────────────────────────────────────────────────

function NuevoModal({
  categories, defaultCategoryId, isNave, onClose,
}: {
  categories: Category[]; defaultCategoryId?: string; isNave?: boolean; onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await createProduct(fd); setDone(true); setTimeout(onClose, 600) })
  }

  const catForSelect = defaultCategoryId ?? ''

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Nuevo producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {isNave && (
            <PricingCalculator iva_rate={0.10} />
          )}
          {/* Inline fields (same as ProductFields but with defaultCategoryId) */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
              <input name="name" required placeholder="Ej: Aceite de oliva virgen"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
              <input name="description" placeholder="Opcional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
              <select name="category_id" defaultValue={catForSelect}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  {isNave ? 'Precio sin IVA (€)' : 'Precio (€) *'}
                </label>
                <input name="price" type="number" step="0.0001" min="0" defaultValue="0"
                  required={!isNave}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] ${
                    isNave ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200'
                  }`} />
                {isNave && <p className="text-xs text-gray-400 mt-0.5">Se calcula arriba</p>}
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
                <select name="unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Cant. mínima</label>
                <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
                <input name="order_increment" type="number" step="0.001" min="0" defaultValue="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={pending || done} className="flex-1 bg-[#1E2B28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#141F1C] disabled:opacity-60">
              {done ? '✓ Creado' : pending ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Products table ────────────────────────────────────────────────────────────

function ProductsTable({
  products, categories, isNave, onEdit,
}: {
  products: Product[]; categories: Category[]; isNave?: boolean; onEdit: (p: Product) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${isNave ? 'min-w-[820px]' : 'min-w-[580px]'}`}>
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">Producto</th>
            {isNave ? (
              <>
                <th className="text-right px-3 py-2.5 text-xs text-gray-400 font-medium">Coste</th>
                <th className="text-right px-3 py-2.5 text-xs text-gray-400 font-medium">Margen</th>
                <th className="text-right px-3 py-2.5 text-xs text-gray-400 font-medium">Sin IVA</th>
                <th className="text-right px-3 py-2.5 text-xs text-amber-600 font-medium">Con IVA</th>
              </>
            ) : (
              <th className="text-right px-4 py-2.5 text-xs text-gray-400 font-medium">Precio</th>
            )}
            <th className="text-left px-3 py-2.5 text-xs text-gray-400 font-medium">Unidad</th>
            <th className="text-center px-3 py-2.5 text-xs text-gray-400 font-medium">Visibilidad</th>
            <th className="px-4 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map(p => {
            const hasCost = Number(p.cost_price) > 0
            const marginPct = Math.round((Number(p.margin) || 0) * 100)
            const ivaPct    = Math.round((Number(p.iva_rate) || 0) * 100)
            const pFinal    = finalPrice(p)
            return (
              <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <div>
                      <p className="font-medium text-[#1C1C1E] leading-tight">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                    </div>
                  </div>
                </td>
                {isNave ? (
                  <>
                    <td className="px-3 py-3 text-right text-xs tabular-nums text-gray-500">
                      {hasCost ? `${Number(p.cost_price).toFixed(2)} €` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs tabular-nums">
                      {hasCost
                        ? <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">{marginPct}%</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs tabular-nums text-gray-600 font-medium">
                      {Number(p.price).toFixed(2)} €
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-sm font-bold text-[#1E2B28] tabular-nums">
                        {pFinal.toFixed(2)} €
                      </div>
                      {ivaPct > 0 && <div className="text-xs text-gray-400">IVA {ivaPct}%</div>}
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-right font-semibold text-[#1E2B28]">{Number(p.price).toFixed(2)} €</td>
                )}
                <td className="px-3 py-3 text-gray-500 text-xs">{p.unit}</td>
                <td className="px-3 py-3 text-center"><ToggleActiveButton product={p} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(p)} title="Editar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E2B28] hover:bg-green-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <DeleteButton product={p} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Category section (collapsible) ───────────────────────────────────────────

function CategorySection({
  categoryId, name, color, products, categories, isNave, onEdit, onAddProduct,
}: {
  categoryId: string; name: string; color: string | null
  products: Product[]; categories: Category[]; isNave?: boolean
  onEdit: (p: Product) => void; onAddProduct: (catId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const visibleCount = products.filter(p => p.is_active).length
  const hiddenCount  = products.length - visibleCount

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <ColorDot color={color} />
        <span className="font-semibold text-[#1C1C1E] flex-1">{name}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">{products.length} productos</span>
          {visibleCount > 0 && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{visibleCount} visibles</span>}
          {hiddenCount  > 0 && <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{hiddenCount} ocultos</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAddProduct(categoryId) }}
          className="flex items-center gap-1 text-xs text-[#1E2B28] hover:bg-green-50 px-2 py-1 rounded-lg transition-colors font-medium"
          title={`Añadir producto en ${name}`}
        >
          <Plus className="w-3.5 h-3.5" />Añadir
        </button>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        products.length > 0
          ? <ProductsTable products={products} categories={categories} isNave={isNave} onEdit={onEdit} />
          : <p className="text-xs text-gray-400 px-6 py-4">Sin productos. Pulsa "Añadir" para crear el primero.</p>
      )}
    </div>
  )
}

// ── Category management tab ───────────────────────────────────────────────────

function CategoriasManager({ categories, productCountByCat }: { categories: Category[]; productCountByCat: Record<string, number> }) {
  const [showNew, setShowNew]         = useState(false)
  const [editingCat, setEditingCat]   = useState<Category | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [seedPending, startSeedTransition]     = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [seedDone, setSeedDone] = useState(false)

  function handleSeed() {
    startSeedTransition(async () => { await seedDefaultCategories(); setSeedDone(true) })
  }
  function handleDeleteCat(id: string) {
    startDeleteTransition(async () => { await deleteCategory(id); setDeletingId(null) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{categories.length} categorías configuradas</p>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={seedPending || seedDone}
            className="flex items-center gap-1.5 text-xs border border-[#1E2B28] text-[#1E2B28] px-3 py-2 rounded-xl hover:bg-green-50 disabled:opacity-50 transition-colors font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            {seedDone ? '✓ Insertadas' : seedPending ? 'Insertando...' : 'Categorías por defecto'}
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-xs bg-[#1E2B28] text-white px-3 py-2 rounded-xl hover:bg-[#141F1C] transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" /> Nueva categoría
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No hay categorías</p>
            <p className="text-xs mt-1">Pulsa "Categorías por defecto" para crear las principales de un tirón</p>
          </div>
        )}
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ background: catColor(cat.color) }} />
            {editingCat?.id === cat.id ? (
              <EditCatInline cat={cat} onClose={() => setEditingCat(null)} />
            ) : (
              <>
                <span className="font-medium text-[#1C1C1E] flex-1 text-sm">{cat.name}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {productCountByCat[cat.id] ?? 0} productos
                </span>
                <button onClick={() => setEditingCat(cat)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E2B28] hover:bg-green-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {deletingId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">¿Eliminar?</span>
                    <button onClick={() => handleDeleteCat(cat.id)} disabled={deletePending}
                      className="p-1 rounded text-red-600 hover:bg-red-50"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setDeletingId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingId(cat.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {showNew && <NewCatForm onClose={() => setShowNew(false)} />}
      <p className="text-xs text-gray-400">Al eliminar una categoría, sus productos quedan sin categoría pero no se borran.</p>
    </div>
  )
}

function EditCatInline({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await updateCategory(cat.id, fd); setDone(true); setTimeout(onClose, 500) })
  }
  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1">
      <input type="color" name="color" defaultValue={cat.color ?? '#6B7280'} className="w-7 h-7 rounded cursor-pointer border border-gray-200" />
      <input name="name" defaultValue={cat.name} required className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      <button type="submit" disabled={pending || done} className="p-1.5 rounded-lg bg-[#1E2B28] text-white hover:bg-[#141F1C] disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
    </form>
  )
}

function NewCatForm({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await createCategory(fd); setDone(true); setTimeout(onClose, 500) })
  }
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#1E2B28] border-dashed px-4 py-3 flex items-center gap-3">
      <input type="color" name="color" defaultValue="#6B7280" className="w-7 h-7 rounded cursor-pointer border border-gray-200" />
      <input name="name" required placeholder="Nombre de la categoría" autoFocus
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      <button type="submit" disabled={pending || done} className="bg-[#1E2B28] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#141F1C] disabled:opacity-50">
        {done ? '✓' : pending ? '...' : 'Crear'}
      </button>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProductosManager({
  products, categories, isNave,
}: {
  products: Product[]
  categories: Category[]
  isNave?: boolean
}) {
  const [tab, setTab]                 = useState<'productos' | 'buscar' | 'categorias'>('productos')
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [nuevoDefaultCat, setNuevoDefaultCat] = useState<string | undefined>()
  const [showNuevo, setShowNuevo]     = useState(false)
  const [search, setSearch]           = useState('')
  const [filterActive, setFilterActive] = useState<'todos' | 'activos' | 'ocultos'>('todos')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Search tab state (independent from Productos tab filters)
  const [buscarQuery, setBuscarQuery]       = useState('')
  const [buscarCategory, setBuscarCategory] = useState<string | null>(null)

  const categoriesById = useMemo(() =>
    Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  )

  const productCountByCat = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of products) {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1
    }
    return counts
  }, [products])

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    if (filterActive === 'activos') return matchSearch && p.is_active
    if (filterActive === 'ocultos') return matchSearch && !p.is_active
    return matchSearch
  }), [products, search, filterActive])

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {}
    const uncategorized: Product[] = []
    for (const p of filtered) {
      if (p.category_id && categoriesById[p.category_id]) {
        if (!map[p.category_id]) map[p.category_id] = []
        map[p.category_id].push(p)
      } else {
        uncategorized.push(p)
      }
    }
    let groups: Array<{ id: string; name: string; color: string | null; products: Product[] }> = categories
      .filter(c => map[c.id]?.length > 0 || !search)
      .map(c => ({ id: c.id, name: c.name, color: c.color, products: map[c.id] ?? [] }))
    if (uncategorized.length > 0) {
      groups.push({ id: '__none__', name: 'Sin categoría', color: '#9CA3AF', products: uncategorized })
    }
    if (selectedCategory) {
      groups = groups.filter(g => g.id === selectedCategory)
    }
    return groups
  }, [filtered, categories, categoriesById, search, selectedCategory])

  const activeCount = products.filter(p => p.is_active).length
  const hiddenCount = products.filter(p => !p.is_active).length

  function handleAddProduct(catId: string) {
    setNuevoDefaultCat(catId === '__none__' ? undefined : catId)
    setShowNuevo(true)
  }

  // ── Search tab: flat list filtered by name/description + optional category ──
  const buscarResults = useMemo(() => {
    const q = buscarQuery.trim().toLowerCase()
    return products.filter(p => {
      const matchQuery = !q || p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)
      const matchCat = !buscarCategory || (buscarCategory === '__none__' ? !p.category_id : p.category_id === buscarCategory)
      return matchQuery && matchCat
    })
  }, [products, buscarQuery, buscarCategory])

  const uncategorizedCount = products.filter(p => !p.category_id).length

  return (
    <>
      {editProduct && (
        <EditModal
          product={editProduct}
          categories={categories}
          isNave={isNave}
          onClose={() => setEditProduct(null)}
        />
      )}
      {showNuevo && (
        <NuevoModal
          categories={categories}
          defaultCategoryId={nuevoDefaultCat}
          isNave={isNave}
          onClose={() => { setShowNuevo(false); setNuevoDefaultCat(undefined) }}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Gestión de Productos</h1>
            <p className="text-gray-500 mt-0.5 text-sm">{products.length} productos · {categories.length} categorías</p>
          </div>
          <button
            onClick={() => { setNuevoDefaultCat(undefined); setShowNuevo(true) }}
            className="flex items-center gap-2 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#141F1C] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([['productos','Productos'],['buscar','Buscar'],['categorias','Categorías']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === k ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {k === 'buscar' && <Search className="w-3.5 h-3.5" />}
              {l}
            </button>
          ))}
        </div>

        {/* ── Productos tab ─────────────────────────────────────────────── */}
        {tab === 'productos' && (
          <>
            {isNave && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <Euro className="w-3.5 h-3.5 shrink-0" />
                <span>Vista nave: Coste · Margen · Precio sin IVA · <strong>Precio final con IVA</strong> (lo que ven los restaurantes)</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              {[
                { key: 'todos',   label: `Todos (${products.length})` },
                { key: 'activos', label: `Visibles (${activeCount})` },
                { key: 'ocultos', label: `Ocultos (${hiddenCount})` },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterActive(f.key as typeof filterActive)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterActive === f.key
                      ? 'bg-[#1E2B28] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1E2B28]'
                  }`}>
                  {f.label}
                </button>
              ))}
              <input type="text" placeholder="Buscar producto..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] w-48" />
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E2B28] text-white transition-colors"
                  >
                    <X className="w-3 h-3" /> Quitar filtro
                  </button>
                )}
                {categories.map(c => {
                  const count = productCountByCat[c.id] ?? 0
                  if (count === 0) return null
                  const isSelected = selectedCategory === c.id
                  return (
                    <button key={c.id}
                      onClick={() => setSelectedCategory(isSelected ? null : c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'border-transparent bg-[#1E2B28] text-white'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-[#1C1C1E]'
                      }`}
                      style={!isSelected ? { borderLeftColor: catColor(c.color), borderLeftWidth: 3 } : undefined}
                    >
                      {c.name}
                      <span className={`px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="space-y-3">
              {grouped.map(g => (
                <CategorySection
                  key={g.id}
                  categoryId={g.id}
                  name={g.name}
                  color={g.color}
                  products={g.products}
                  categories={categories}
                  isNave={isNave}
                  onEdit={setEditProduct}
                  onAddProduct={handleAddProduct}
                />
              ))}
              {grouped.length === 0 && (
                <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p>No hay productos que coincidan</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Los productos <strong>Ocultos</strong> no aparecen en el catálogo de restaurantes, pero su historial de inventario se conserva.
            </p>
          </>
        )}

        {/* ── Buscar tab ────────────────────────────────────────────────── */}
        {tab === 'buscar' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar producto por nombre o descripción..."
                value={buscarQuery}
                onChange={e => setBuscarQuery(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-2">Filtrar por categoría</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setBuscarCategory(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    buscarCategory === null
                      ? 'border-transparent bg-[#1E2B28] text-white'
                      : 'border-gray-200 hover:border-gray-300 bg-white text-[#1C1C1E]'
                  }`}
                >
                  Todas
                  <span className={`px-1.5 py-0.5 rounded-full ${buscarCategory === null ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{products.length}</span>
                </button>
                {categories.map(c => {
                  const count = productCountByCat[c.id] ?? 0
                  if (count === 0) return null
                  const isSelected = buscarCategory === c.id
                  return (
                    <button key={c.id}
                      onClick={() => setBuscarCategory(isSelected ? null : c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'border-transparent bg-[#1E2B28] text-white'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-[#1C1C1E]'
                      }`}
                      style={!isSelected ? { borderLeftColor: catColor(c.color), borderLeftWidth: 3 } : undefined}
                    >
                      <ColorDot color={isSelected ? '#ffffff' : c.color} />
                      {c.name}
                      <span className={`px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                    </button>
                  )
                })}
                {uncategorizedCount > 0 && (
                  <button
                    onClick={() => setBuscarCategory(buscarCategory === '__none__' ? null : '__none__')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      buscarCategory === '__none__'
                        ? 'border-transparent bg-[#1E2B28] text-white'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-[#1C1C1E]'
                    }`}
                  >
                    Sin categoría
                    <span className={`px-1.5 py-0.5 rounded-full ${buscarCategory === '__none__' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{uncategorizedCount}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{buscarResults.length} producto{buscarResults.length !== 1 ? 's' : ''} encontrado{buscarResults.length !== 1 ? 's' : ''}</p>
              {(buscarQuery || buscarCategory) && (
                <button
                  onClick={() => { setBuscarQuery(''); setBuscarCategory(null) }}
                  className="text-xs text-gray-400 hover:text-[#1E2B28] flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar filtros
                </button>
              )}
            </div>

            {buscarResults.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <ProductsTable products={buscarResults} categories={categories} isNave={isNave} onEdit={setEditProduct} />
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p>No hay productos que coincidan con la búsqueda</p>
              </div>
            )}
          </div>
        )}

        {/* ── Categorías tab ─────────────────────────────────────────────── */}
        {tab === 'categorias' && (
          <CategoriasManager categories={categories} productCountByCat={productCountByCat} />
        )}
      </div>
    </>
  )
}
