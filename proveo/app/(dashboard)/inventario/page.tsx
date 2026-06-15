import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { InventarioTable } from '@/components/inventory/InventarioTable'
import { Package } from 'lucide-react'

export default async function InventarioPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const sb = supabase as any

  const isNave = profile.organizations.type === 'nave'

  // Cargar TODOS los productos activos (sin deleted_at) con su categoría
  const { data: products } = await sb
    .from('products')
    .select('id, name, unit, product_categories(name)')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  // Cargar las entradas de inventario existentes
  let inventoryMap: Record<string, { current_stock: number; min_stock: number; last_updated: string }> = {}

  if (isNave) {
    const { data } = await sb
      .from('nave_inventory')
      .select('product_id, current_stock, min_stock, last_updated')
    ;(data ?? []).forEach((row: any) => { inventoryMap[row.product_id] = row })
  } else {
    const { data } = await sb
      .from('restaurant_inventory')
      .select('product_id, current_stock, min_stock, last_updated')
      .eq('organization_id', profile.organization_id)
    ;(data ?? []).forEach((row: any) => { inventoryMap[row.product_id] = row })
  }

  // Combinar: todos los productos con su stock (0 si no hay entrada)
  const rows = (products ?? []).map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    product_unit: p.unit,
    category_name: p.product_categories?.name ?? null,
    current_stock: inventoryMap[p.id]?.current_stock ?? 0,
    min_stock: inventoryMap[p.id]?.min_stock ?? 0,
    last_updated: inventoryMap[p.id]?.last_updated ?? null,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">Inventario</h1>
        <p className="text-gray-500 mt-1">
          {isNave
            ? 'Controla cuánto tienes de cada producto en el obrador.'
            : 'Controla cuánto tienes de cada producto en tu restaurante.'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay productos activos todavía</p>
          <p className="text-sm mt-1">Añade productos desde Gestión de Productos</p>
        </div>
      ) : (
        <InventarioTable
          rows={rows}
          isNave={isNave}
          organizationId={profile.organization_id}
        />
      )}
    </div>
  )
}
