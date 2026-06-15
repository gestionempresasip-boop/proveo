'use client'

import { useState } from 'react'
import { createProduct } from '@/app/actions/products'
import { Plus, X } from 'lucide-react'

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'caja', 'bandeja']

type Category = { id: string; name: string }

export function NuevoProductoModal({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await createProduct(formData)
      setOpen(false)
      ;(e.target as HTMLFormElement).reset()
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
        className="flex items-center gap-2 bg-[#1B4332] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163828] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo producto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-[#1C1C1E]">Nuevo producto</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre *</label>
                <input
                  name="name" required
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                  placeholder="Ej. Tomate cherry"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Precio (€) *</label>
                  <input
                    name="price" type="number" step="0.01" min="0" required
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unidad *</label>
                  <select
                    name="unit" required
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoría</label>
                  <select
                    name="category_id"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  name="description" rows={2}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] resize-none"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-[#1B4332] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#163828] disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
