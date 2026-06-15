'use client'

import { useState, useTransition, useMemo } from 'react'
import { Package, Pencil, Trash2, Eye, EyeOff, Plus, X, Check, ChevronDown, ChevronRight, Sparkles, Tag } from 'lucide-react'
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
  product_categories: { name: string } | null
}

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']

// ── Helpers ──────────────────────────────────────────────────────────────────

function catColor(color: string | null) { return color ?? '#6B7280' }

function ColorDot({ color }: { color: string | null }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(color) }} />
}

// ── Inline toggle active ─────────────────────────────────────────────────────

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

// ── Delete with confirmation ─────────────────────────────────────────────────

function DeleteButton({ product }: { product: Product }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  function doDelete() { startTransition(async () => { await softDeleteProduct(product.id) }) }
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 whitespace-nowrap">¿Eliminar?</span>
        <button onClick={doDelete} disabled={pending} className="p-1 rounded text-red-600 hover:bg-red-50" title="Confirmar"><Check className="w-4 h-4" /></button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100" title="Cancelar"><X className="w-4 h-4" /></button>
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

// ── Product form fields (shared by Edit and Nuevo) ───────────────────────────

function ProductFields({ product, categories }: { product?: Product; categories: Category[] }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
        <input name="name" defaultValue={product?.name} required placeholder="Ej: Aceite de oliva virgen"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
        <input name="description" defaultValue={product?.description ?? ''} placeholder="Opcional"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">URL de imagen</label>
        <input name="image_url" type="url" defaultValue={(product as any)?.image_url ?? ''} placeholder="https://... (pega una URL de imagen)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
        <p className="text-xs text-gray-400 mt-0.5">Pega un enlace a la foto del producto (JPG, PNG, WebP)</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
        <select name="category_id" defaultValue={product?.category_id ?? ''}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
          <option value="">Sin categoría</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Precio (€) *</label>
          <input name="price" type="number" step="0.01" min="0" defaultValue={product?.price ?? 0} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
          <select name="unit" defaultValue={product?.unit ?? 'kg'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Cant. mínima</label>
          <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue={product?.min_order_quantity ?? 1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
          <input name="order_increment" type="number" step="0.001" min="0" defaultValue={product?.order_increment ?? 1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ product, categories, onClose }: { product: Product; categories: Category[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await updateProduct(product.id, fd); setDone(true); setTimeout(onClose, 600) })
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Editar producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <ProductFields product={product} categories={categories} />
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={pending || done} className="flex-1 bg-[#1B4332] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#163828] disabled:opacity-60">
              {done ? '✓ Guardado' : pending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New product modal ────────────────────────────────────────────────────────

function NuevoModal({ categories, defaultCategoryId, onClose }: { categories: Category[]; defaultCategoryId?: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await createProduct(fd); setDone(true); setTimeout(onClose, 600) })
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Nuevo producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Override defaultValue for category_id via hidden + select default */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
              <input name="name" required placeholder="Ej: Aceite de oliva virgen"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
              <input name="description" placeholder="Opcional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
              <select name="category_id" defaultValue={defaultCategoryId ?? ''}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Precio (€) *</label>
                <input name="price" type="number" step="0.01" min="0" defaultValue="0" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
                <select name="unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Cant. mínima</label>
                <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
                <input name="order_increment" type="number" step="0.001" min="0" defaultValue="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
            </div>
          </div>
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={pending || done} className="flex-1 bg-[#1B4332] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#163828] disabled:opacity-60">
              {done ? '✓ Creado' : pending ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Products table (within a category section) ───────────────────────────────

function ProductsTable({ products, categories, onEdit }: { products: Product[]; categories: Category[]; onEdit: (p: Product) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[580px]">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">Producto</th>
            <th className="text-right px-4 py-2.5 text-xs text-gray-400 font-medium">Precio</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">Unidad</th>
            <th className="text-center px-4 py-2.5 text-xs text-gray-400 font-medium">Visibilidad</th>
            <th className="px-4 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map(p => (
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
              <td className="px-4 py-3 text-right font-semibold text-[#1B4332]">{Number(p.price).toFixed(2)} €</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{p.unit}</td>
              <td className="px-4 py-3 text-center"><ToggleActiveButton product={p} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(p)} title="Editar"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-green-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <DeleteButton product={p} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Category section (collapsible) ───────────────────────────────────────────

function CategorySection({
  categoryId, name, color, products, categories, onEdit, onAddProduct,
}: {
  categoryId: string; name: string; color: string | null
  products: Product[]; categories: Category[]
  onEdit: (p: Product) => void; onAddProduct: (catId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const visibleCount = products.filter(p => p.is_active).length
  const hiddenCount = products.length - visibleCount

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <ColorDot color={color} />
        <span className="font-semibold text-[#1C1C1E] flex-1">{name}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">{products.length} productos</span>
          {visibleCount > 0 && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{visibleCount} visibles</span>}
          {hiddenCount > 0 && <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{hiddenCount} ocultos</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAddProduct(categoryId) }}
          className="flex items-center gap-1 text-xs text-[#1B4332] hover:bg-green-50 px-2 py-1 rounded-lg transition-colors font-medium"
          title={`Añadir producto en ${name}`}
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir
        </button>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Products table */}
      {open && (
        products.length > 0
          ? <ProductsTable products={products} categories={categories} onEdit={onEdit} />
          : <p className="text-xs text-gray-400 px-6 py-4">Sin productos. Pulsa "Añadir" para crear el primero.</p>
      )}
    </div>
  )
}

// ── Category management tab ──────────────────────────────────────────────────

function CategoriasManager({ categories, productCountByCat }: { categories: Category[]; productCountByCat: Record<string, number> }) {
  const [showNew, setShowNew] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [seedPending, startSeedTransition] = useTransition()
  const [seedDone, setSeedDone] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletePending, startDeleteTransition] = useTransition()

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
          <button
            onClick={handleSeed}
            disabled={seedPending || seedDone}
            className="flex items-center gap-1.5 text-xs border border-[#1B4332] text-[#1B4332] px-3 py-2 rounded-xl hover:bg-green-50 disabled:opacity-50 transition-colors font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seedDone ? '✓ Insertadas' : seedPending ? 'Insertando...' : 'Categorías por defecto'}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-xs bg-[#1B4332] text-white px-3 py-2 rounded-xl hover:bg-[#163828] transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva categoría
          </button>
        </div>
      </div>

      {/* Category list */}
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
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-green-50 transition-colors">
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

      {/* New category inline form */}
      {showNew && <NewCatForm onClose={() => setShowNew(false)} />}

      <p className="text-xs text-gray-400">
        Al eliminar una categoría, sus productos quedan sin categoría pero no se borran.
      </p>
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
      <input name="name" defaultValue={cat.name} required className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
      <button type="submit" disabled={pending || done} className="p-1.5 rounded-lg bg-[#1B4332] text-white hover:bg-[#163828] disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#1B4332] border-dashed px-4 py-3 flex items-center gap-3">
      <input type="color" name="color" defaultValue="#6B7280" className="w-7 h-7 rounded cursor-pointer border border-gray-200" />
      <input name="name" required placeholder="Nombre de la categoría" autoFocus
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
      <button type="submit" disabled={pending || done} className="bg-[#1B4332] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#163828] disabled:opacity-50">
        {done ? '✓' : pending ? '...' : 'Crear'}
      </button>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </form>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProductosManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [tab, setTab] = useState<'productos' | 'categorias'>('productos')
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [nuevoDefaultCat, setNuevoDefaultCat] = useState<string | undefined>()
  const [showNuevo, setShowNuevo] = useState(false)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'todos' | 'activos' | 'ocultos'>('todos')

  // Category map for quick lookup
  const categoriesById = useMemo(() =>
    Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  )

  // Product count per category (for the category manager)
  const productCountByCat = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of products) {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1
    }
    return counts
  }, [products])

  // Filter products
  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    if (filterActive === 'activos') return matchSearch && p.is_active
    if (filterActive === 'ocultos') return matchSearch && !p.is_active
    return matchSearch
  }), [products, search, filterActive])

  // Group by category (sorted by order_index)
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
    // Build ordered list: categories sorted by order_index, then uncategorized
    const groups: Array<{ id: string; name: string; color: string | null; products: Product[] }> = categories
      .filter(c => map[c.id]?.length > 0 || !search) // hide empty sections during search
      .map(c => ({ id: c.id, name: c.name, color: c.color, products: map[c.id] ?? [] }))

    if (uncategorized.length > 0) {
      groups.push({ id: '__none__', name: 'Sin categoría', color: '#9CA3AF', products: uncategorized })
    }
    return groups
  }, [filtered, categories, categoriesById, search])

  const activeCount = products.filter(p => p.is_active).length
  const hiddenCount = products.filter(p => !p.is_active).length

  function handleAddProduct(catId: string) {
    setNuevoDefaultCat(catId === '__none__' ? undefined : catId)
    setShowNuevo(true)
  }

  return (
    <>
      {editProduct && (
        <EditModal product={editProduct} categories={categories} onClose={() => setEditProduct(null)} />
      )}
      {showNuevo && (
        <NuevoModal categories={categories} defaultCategoryId={nuevoDefaultCat} onClose={() => { setShowNuevo(false); setNuevoDefaultCat(undefined) }} />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Gestión de Productos</h1>
            <p className="text-gray-500 mt-0.5 text-sm">{products.length} productos · {categories.length} categorías</p>
          </div>
          <button onClick={() => { setNuevoDefaultCat(undefined); setShowNuevo(true) }}
            className="flex items-center gap-2 bg-[#1B4332] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#163828] transition-colors">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([['productos','Productos'],['categorias','Categorías']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === k ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{l}</button>
          ))}
        </div>

        {/* ── Productos tab ───────────────────────────────────────────────── */}
        {tab === 'productos' && (
          <>
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { key: 'todos',   label: `Todos (${products.length})` },
                { key: 'activos', label: `Visibles (${activeCount})` },
                { key: 'ocultos', label: `Ocultos (${hiddenCount})` },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterActive(f.key as typeof filterActive)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterActive === f.key
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4332]'
                  }`}>
                  {f.label}
                </button>
              ))}
              <input type="text" placeholder="Buscar producto..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] w-48" />
            </div>

            {/* Category chips (quick filter) */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => {
                  const count = grouped.find(g => g.id === c.id)?.products.length ?? 0
                  if (count === 0 && !search) return null
                  return (
                    <button key={c.id}
                      onClick={() => setSearch(count > 0 ? '' : search)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 hover:border-gray-300 bg-white transition-colors"
                      style={{ borderLeftColor: catColor(c.color), borderLeftWidth: 3 }}
                    >
                      {c.name}
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-500">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Category sections */}
            <div className="space-y-3">
              {grouped.map(g => (
                <CategorySection
                  key={g.id}
                  categoryId={g.id}
                  name={g.name}
                  color={g.color}
                  products={g.products}
                  categories={categories}
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

        {/* ── Categorías tab ──────────────────────────────────────────────── */}
        {tab === 'categorias' && (
          <CategoriasManager categories={categories} productCountByCat={productCountByCat} />
        )}
      </div>
    </>
  )
}
