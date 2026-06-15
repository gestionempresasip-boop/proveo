'use client'

import { useState, useTransition } from 'react'
import { Package, Pencil, Trash2, Eye, EyeOff, Plus, X, Check } from 'lucide-react'
import { toggleProductActive, softDeleteProduct, updateProduct, createProduct } from '@/app/actions/products'

type Category = { id: string; name: string }
type Product = {
  id: string
  name: string
  description: string | null
  price: number
  unit: string
  min_order_quantity: number
  order_increment: number
  is_active: boolean
  category_id: string | null
  product_categories: { name: string } | null
}

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']

// ── Inline toggle active ─────────────────────────────────────────────────────
function ToggleActiveButton({ product }: { product: Product }) {
  const [active, setActive] = useState(product.is_active)
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      setActive(prev => !prev)
      await toggleProductActive(product.id, active)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={active ? 'Pincha para desactivar (ocultarlo a los restaurantes)' : 'Pincha para activar'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
        active
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
      }`}
    >
      {active ? (
        <><Eye className="w-3.5 h-3.5" />Visible</>
      ) : (
        <><EyeOff className="w-3.5 h-3.5" />Oculto</>
      )}
    </button>
  )
}

// ── Delete with confirmation ─────────────────────────────────────────────────
function DeleteButton({ product }: { product: Product }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function doDelete() {
    startTransition(async () => {
      await softDeleteProduct(product.id)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 whitespace-nowrap">¿Eliminar?</span>
        <button
          onClick={doDelete}
          disabled={pending}
          className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-40"
          title="Confirmar eliminación"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="p-1 rounded text-gray-400 hover:bg-gray-100"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Eliminar ${product.name}`}
      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

// ── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({ product, categories, onClose }: { product: Product; categories: Category[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateProduct(product.id, formData)
      setDone(true)
      setTimeout(onClose, 600)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Editar producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
            <input name="name" defaultValue={product.name} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
            <input name="description" defaultValue={product.description ?? ''} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Precio (€) *</label>
              <input name="price" type="number" step="0.01" min="0" defaultValue={product.price} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
              <select name="unit" defaultValue={product.unit} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
            <select name="category_id" defaultValue={product.category_id ?? ''} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Cantidad mínima</label>
              <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue={product.min_order_quantity} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
              <input name="order_increment" type="number" step="0.001" min="0" defaultValue={product.order_increment} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={pending || done} className="flex-1 bg-[#1B4332] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#163828] disabled:opacity-60">
              {done ? '✓ Guardado' : pending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New product modal ────────────────────────────────────────────────────────
function NuevoModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createProduct(formData)
      setDone(true)
      setTimeout(onClose, 600)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1C1C1E]">Nuevo producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nombre *</label>
            <input name="name" required placeholder="Ej: Aceite de oliva virgen" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Descripción</label>
            <input name="description" placeholder="Opcional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Precio (€) *</label>
              <input name="price" type="number" step="0.01" min="0" required defaultValue="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Unidad *</label>
              <select name="unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Categoría</label>
            <select name="category_id" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]">
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Cantidad mínima</label>
              <input name="min_order_quantity" type="number" step="0.001" min="0" defaultValue="1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Incremento</label>
              <input name="order_increment" type="number" step="0.001" min="0" defaultValue="1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
          </div>
          <div className="pt-2 flex gap-2">
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

// ── Main component ───────────────────────────────────────────────────────────
export function ProductosManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'todos' | 'activos' | 'ocultos'>('todos')

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    if (filterActive === 'activos') return matchSearch && p.is_active
    if (filterActive === 'ocultos') return matchSearch && !p.is_active
    return matchSearch
  })

  const activeCount = products.filter(p => p.is_active).length
  const hiddenCount = products.filter(p => !p.is_active).length

  return (
    <>
      {editProduct && <EditModal product={editProduct} categories={categories} onClose={() => setEditProduct(null)} />}
      {showNuevo && <NuevoModal categories={categories} onClose={() => setShowNuevo(false)} />}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1C1C1E]">Gestión de Productos</h1>
            <p className="text-gray-500 mt-1">{products.length} productos en total</p>
          </div>
          <button
            onClick={() => setShowNuevo(true)}
            className="flex items-center gap-2 bg-[#1B4332] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#163828] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo producto
          </button>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'todos', label: `Todos (${products.length})` },
            { key: 'activos', label: `Visibles (${activeCount})` },
            { key: 'ocultos', label: `Ocultos (${hiddenCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterActive(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterActive === f.key
                  ? 'bg-[#1B4332] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4332]'
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] w-52"
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Producto</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoría</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Precio</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Unidad</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Visibilidad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-300 shrink-0" />
                      <div>
                        <p className="font-medium text-[#1C1C1E]">{p.name}</p>
                        {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.product_categories?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1B4332]">{Number(p.price).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <ToggleActiveButton product={p} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditProduct(p)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-green-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <DeleteButton product={p} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p>No hay productos</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Los productos <strong>Ocultos</strong> no aparecen en el catálogo de los restaurantes, pero su historial de inventario se conserva.
          Los productos <strong>eliminados</strong> desaparecen de la lista pero sus datos históricos quedan guardados.
        </p>
      </div>
    </>
  )
}
