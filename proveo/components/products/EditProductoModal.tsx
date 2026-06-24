'use client'

import { useState } from 'react'
import { updateProduct } from '@/app/actions/products'
import { Pencil, X } from 'lucide-react'

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']

type Category = { id: string; name: string }
type Product = {
  id: string; name: string; price: number; unit: string
  description: string | null; category_id: string | null
  min_order_quantity: number; order_increment: number
}

export function EditProductoModal({ product, categories }: { product: Product; categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await updateProduct(product.id, formData)
      setOpen(false)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-[#1E2B28] transition-colors"
        title="Editar producto"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-black">Editar producto</h2>
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre *</label>
                <input
                  name="name" required defaultValue={product.name}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Precio (€) *</label>
                  <input
                    name="price" type="number" step="0.01" min="0" required
                    defaultValue={product.price}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unidad *</label>
                  <select
                    name="unit" required defaultValue={product.unit}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Cantidad mínima</label>
                  <input
                    name="min_order_quantity" type="number" step="0.001" min="0"
                    defaultValue={product.min_order_quantity ?? 1}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Incremento pedido</label>
                  <input
                    name="order_increment" type="number" step="0.001" min="0"
                    defaultValue={product.order_increment ?? 1}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoría</label>
                  <select
                    name="category_id"
                    defaultValue={product.category_id ?? ''}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  name="description" rows={2} defaultValue={product.description ?? ''}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] resize-none"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#1E2B28] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#141F1C] disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
