'use client'

import { useState } from 'react'
import { createRecipe } from '@/app/actions/recipes'
import { X, Plus, Trash2 } from 'lucide-react'

type Product = { id: string; name: string; unit: string; price: number }

type Ingredient = { product_id: string; quantity: string; unit: string }

export function NuevaRecetaModal({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { product_id: '', quantity: '', unit: '' },
  ])

  function addIngredient() {
    setIngredients(prev => [...prev, { product_id: '', quantity: '', unit: '' }])
  }

  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setIngredients(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) next[i].unit = prod.unit
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    ingredients.forEach(ing => {
      formData.append('ingredient_product_id', ing.product_id)
      formData.append('ingredient_quantity', ing.quantity)
      formData.append('ingredient_unit', ing.unit)
    })
    try {
      await createRecipe(formData)
      setOpen(false)
      setIngredients([{ product_id: '', quantity: '', unit: '' }])
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
        className="flex items-center gap-2 bg-[#1E2B28] hover:bg-[#141F1C] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nueva receta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-[#1C1C1E]">Nueva receta / escandallo</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Nombre *</label>
                  <input name="name" required className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" placeholder="Ej. Croquetas de jamón" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoría</label>
                  <input name="category" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" placeholder="Ej. Entrantes" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Raciones</label>
                  <input name="servings" type="number" min="1" defaultValue="1" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Precio venta (€)</label>
                  <input name="sale_price" type="number" step="0.01" min="0" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" placeholder="0.00" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <textarea name="description" rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] resize-none" placeholder="Opcional" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Ingredientes</label>
                  <button type="button" onClick={addIngredient} className="text-xs text-[#1E2B28] hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Añadir
                  </button>
                </div>
                <div className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={ing.product_id}
                        onChange={e => updateIngredient(i, 'product_id', e.target.value)}
                        className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                      >
                        <option value="">Producto...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={ing.quantity}
                        onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                        className="w-20 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                        placeholder="Cant."
                      />
                      <span className="text-xs text-gray-400 w-10 text-center">{ing.unit}</span>
                      <button type="button" onClick={() => removeIngredient(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-[#1E2B28] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#141F1C] disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Crear receta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
