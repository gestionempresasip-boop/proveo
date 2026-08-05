import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { redirect } from 'next/navigation'
import { AlmacenClient } from '@/components/warehouse/AlmacenClient'

export default async function AlmacenPage() {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') redirect('/inventario')

  const supabase = await createClient()
  const sb = supabase as any

  const [
    { data: products },
    { data: inventoryRows },
    { data: warehouseItems },
    { data: warehouseCategories },
  ] = await Promise.all([
    sb.from('products')
      .select('id, name, unit, allows_box_order, box_units, category_id, product_categories!products_category_id_fkey(name, color)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    sb.from('nave_inventory')
      .select('product_id, current_stock, min_stock, last_updated'),
    sb.from('warehouse_items')
      .select('*, warehouse_categories(name, color)')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('name'),
    sb.from('warehouse_categories')
      .select('id, name, color')
      .order('order_index'),
  ])

  const inventoryMap: Record<string, { current_stock: number; min_stock: number; last_updated: string | null }> = {}
  ;(inventoryRows ?? []).forEach((r: any) => { inventoryMap[r.product_id] = r })

  const catalogItems = (products ?? []).map((p: any) => ({
    product_id:      p.id,
    product_name:    p.name,
    product_unit:    p.unit,
    category_name:   p.product_categories?.name ?? null,
    category_color:  p.product_categories?.color ?? null,
    allows_box_order: p.allows_box_order ?? false,
    box_units:       p.box_units ?? null,
    current_stock:   inventoryMap[p.id]?.current_stock ?? 0,
    min_stock:       inventoryMap[p.id]?.min_stock ?? 0,
    last_updated:    inventoryMap[p.id]?.last_updated ?? null,
  }))

  const supplies = (warehouseItems ?? []).map((w: any) => ({
    id:             w.id,
    name:           w.name,
    description:    w.description ?? null,
    unit:           w.unit,
    current_stock:  Number(w.current_stock),
    min_stock:      Number(w.min_stock),
    supplier:       w.supplier ?? null,
    notes:          w.notes ?? null,
    category_id:    w.category_id ?? null,
    category_name:  w.warehouse_categories?.name ?? null,
    category_color: w.warehouse_categories?.color ?? null,
    updated_at:     w.updated_at ?? null,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Almacén</h1>
        <p className="text-gray-700 mt-1">
          Todo lo que tienes en la nave — productos del catálogo y suministros propios.
        </p>
      </div>
      <AlmacenClient
        catalogItems={catalogItems}
        supplies={supplies}
        warehouseCategories={warehouseCategories ?? []}
        organizationId={profile.organization_id}
      />
    </div>
  )
}
