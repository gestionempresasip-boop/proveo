import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import { NuevoProductoModal } from '@/components/products/NuevoProductoModal'
import { EditProductoModal } from '@/components/products/EditProductoModal'
import { toggleProductActive } from '@/app/actions/products'

export default async function AdminProductosPage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || profile.role === 'nave_manager'

  if (!canEdit) {
    return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>
  }

  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: products }, { data: categories }] = await Promise.all([
    sb.from('products').select('*, product_categories(name)').order('name'),
    sb.from('product_categories').select('id, name').order('name'),
  ])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Gestión de Productos</h1>
          <p className="text-gray-500 mt-1">{products?.length ?? 0} productos en el catálogo</p>
        </div>
        <NuevoProductoModal categories={categories ?? []} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Producto</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoría</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Precio</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Unidad</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Mín. pedido</th>
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
                    {p.description && (
                      <span className="text-xs text-gray-400 font-normal">— {p.description}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.product_categories?.name ?? '—'}</td>
                <td className="px-4 py-3 font-semibold text-[#1B4332]">{Number(p.price).toFixed(2)} €</td>
                <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                <td className="px-4 py-3 text-gray-500">
                  {p.min_order_quantity} {p.unit}
                  {p.order_increment !== p.min_order_quantity && ` (+${p.order_increment})`}
                </td>
                <td className="px-4 py-3">
                  <form action={toggleProductActive.bind(null, p.id, p.is_active)}>
                    <button
                      type="submit"
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        p.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">
                  <EditProductoModal
                    product={{
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      unit: p.unit,
                      description: p.description,
                      category_id: p.category_id,
                      min_order_quantity: p.min_order_quantity,
                      order_increment: p.order_increment,
                    }}
                    categories={categories ?? []}
                  />
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
