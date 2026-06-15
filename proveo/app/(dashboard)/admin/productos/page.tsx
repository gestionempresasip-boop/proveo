import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { Package, Plus, Pencil } from 'lucide-react'

export default async function AdminProductosPage() {
  const profile = await getAuthProfile()
  if (profile.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products } = await (supabase as any)
    .from('products')
    .select('*, product_categories(name)')
    .order('name')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Gestión de Productos</h1>
          <p className="text-gray-500 mt-1">{products?.length ?? 0} productos en el catálogo</p>
        </div>
        <button className="flex items-center gap-2 bg-[#1B4332] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#152d23] transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo producto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Producto</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoría</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Precio</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Unidad</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products?.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#1C1C1E]">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400 shrink-0" />
                    {p.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.product_categories?.name ?? '—'}</td>
                <td className="px-4 py-3 font-medium">{Number(p.price).toFixed(2)} €</td>
                <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!products || products.length === 0) && (
          <div className="text-center py-12 text-gray-400">No hay productos</div>
        )}
      </div>
    </div>
  )
}
