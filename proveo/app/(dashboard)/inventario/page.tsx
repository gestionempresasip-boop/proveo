import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Package } from 'lucide-react'

export default async function InventarioPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()

  const isNave = profile.organizations.type === 'nave'

  let inventory: Array<{
    id: string
    current_stock: number
    min_stock: number
    last_updated: string
    products: { name: string; unit: string; image_url: string | null } | null
  }> = []

  if (isNave) {
    const { data } = await supabase
      .from('nave_inventory')
      .select('*, products(name, unit, image_url)')
      .order('last_updated', { ascending: false })
    inventory = (data ?? []) as typeof inventory
  } else {
    const { data } = await supabase
      .from('restaurant_inventory')
      .select('*, products(name, unit, image_url)')
      .eq('organization_id', profile.organization_id)
      .order('last_updated', { ascending: false })
    inventory = (data ?? []) as typeof inventory
  }

  const lowStock = inventory.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">Inventario</h1>
        <p className="text-gray-500 mt-1">
          {isNave ? 'Stock disponible en la nave' : 'Stock en tu restaurante'}
        </p>
      </div>

      {/* Alerta stock mínimo */}
      {lowStock.length > 0 && (
        <Card className="border-red-200 bg-red-50 border-0 shadow-none">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">
                {lowStock.length} producto{lowStock.length > 1 ? 's' : ''} con stock bajo
              </p>
              <p className="text-sm text-red-600 mt-0.5">
                {lowStock.map(i => i.products?.name).join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de inventario */}
      {inventory.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay productos en el inventario</p>
          <p className="text-sm mt-1">Los productos aparecerán aquí cuando se configuren</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                      Producto
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                      Stock actual
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                      Stock mínimo
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                      Estado
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                      Última actualización
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.map((item) => {
                    const isLow = item.current_stock <= item.min_stock && item.min_stock > 0
                    const isEmpty = item.current_stock === 0
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isEmpty ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-4">
                          <span className="font-medium text-[#1C1C1E] text-sm">
                            {item.products?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`font-bold text-sm ${isEmpty ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-[#1B4332]'}`}>
                            {item.current_stock} {item.products?.unit}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-sm text-gray-500">
                            {item.min_stock} {item.products?.unit}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {isEmpty ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">Sin stock</Badge>
                          ) : isLow ? (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 border text-xs">Stock bajo</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">OK</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-xs text-gray-400">
                            {new Date(item.last_updated).toLocaleDateString('es-ES', {
                              day: 'numeric', month: 'short'
                            })}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
