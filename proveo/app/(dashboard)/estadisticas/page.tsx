import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { EstadisticasClient } from '@/components/stats/EstadisticasClient'
import { redirect } from 'next/navigation'

// Algunos productos tienen el coste registrado por caja/pieza entera en
// products.cost_price (ej. "Jamón bellota" a 518,40€ la caja de 40 sobres),
// pero se piden y facturan por unidad suelta o por kg — no hay ningún campo
// en la base de datos que relacione ambas cosas. Esto SOLO ajusta el coste
// que usa el cálculo de margen de Informes; no toca products.cost_price, ni
// el catálogo, ni cómo piden los restaurantes. Si aparecen más productos
// con el mismo patrón, se añaden aquí.
const COST_PACKAGE_SIZE: Record<string, number> = {
  'a60f7725-e96f-4540-a191-054e9b9ac3b7': 40, // Jamón bellota c. cuchillo caja — 518,40€ / 40 sobres
  '44a1236c-65de-4041-bd22-1a44b6b5c881': 8,  // Secreto ibérico congelado caja — 167,60€ / 8 kg
}

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') redirect('/dashboard')
  const sb = supabase as any

  // Traer pedidos + restaurantes + stock en paralelo (son independientes
  // entre sí). Excluimos cancelados. El coste (cost_price) se añade al
  // join de productos para poder calcular márgenes sin tocar la forma
  // de "lines" que ya usan las pestañas existentes — solo se le suma un
  // campo más.
  const [{ data: orders }, { data: restaurants }, { data: stock }] = await Promise.all([
    sb
      .from('orders')
      .select(`
        id, order_number, created_at, total_price, restaurant_id, status,
        organizations!restaurant_id(id, name),
        order_items(id, product_id, quantity, rectified_quantity, unit, unit_price, total_price,
          products(name, cost_price, iva_rate)
        )
      `)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false }),
    sb
      .from('organizations')
      .select('id, name')
      .eq('type', 'restaurante')
      .order('name'),
    sb
      .from('nave_inventory')
      .select('product_id, current_stock, min_stock'),
  ])

  // Aplanar a filas por línea de pedido (para cálculos granulares)
  type Line = {
    order_id: string; order_number: number; created_at: string
    restaurant_id: string; restaurant_name: string
    product_id: string; product_name: string
    quantity: number; unit: string; unit_price: number
    item_total: number; order_total: number
    cost_price: number; iva_rate: number
  }

  const lines: Line[] = []
  for (const o of orders ?? []) {
    for (const item of o.order_items ?? []) {
      lines.push({
        order_id: o.id,
        order_number: o.order_number,
        created_at: o.created_at,
        restaurant_id: o.restaurant_id,
        restaurant_name: (o.organizations as any)?.name ?? 'Desconocido',
        product_id: item.product_id,
        product_name: (item.products as any)?.name ?? 'Producto eliminado',
        // La cantidad realmente entregada/facturada, no la aproximada del
        // pedido — en productos "por cajón" (ej. calamar, ~8kg/caja
        // aproximados) la nave corrige el peso real al preparar el pedido,
        // y total_price ya refleja esa corrección. Usar "quantity" a secas
        // aquí desincroniza coste (con la cantidad aproximada, más alta)
        // frente a ingreso (con la cantidad real, más baja), y puede dar
        // márgenes negativos falsos.
        quantity: Number(item.rectified_quantity ?? item.quantity),
        unit: item.unit,
        unit_price: Number(item.unit_price),
        item_total: Number(item.total_price),
        order_total: Number(o.total_price),
        cost_price: Number((item.products as any)?.cost_price ?? 0) / (COST_PACKAGE_SIZE[item.product_id] ?? 1),
        iva_rate: Number((item.products as any)?.iva_rate ?? 0),
      })
    }
  }

  const stockRows = (stock ?? []).map((s: any) => ({
    product_id: s.product_id,
    current_stock: Number(s.current_stock),
    min_stock: Number(s.min_stock),
  }))

  return (
    <EstadisticasClient
      lines={lines}
      restaurants={restaurants ?? []}
      stockRows={stockRows}
    />
  )
}
