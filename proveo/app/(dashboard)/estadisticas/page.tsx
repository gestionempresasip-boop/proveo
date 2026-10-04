import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { EstadisticasClient } from '@/components/stats/EstadisticasClient'
import { InformesGate } from '@/components/stats/InformesGate'
import { isInformesUnlocked } from '@/app/actions/informesGate'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Segunda barrera además del PIN de la nave: sin el código, ni siquiera
  // se llega a pedir los pedidos/costes a Supabase.
  if (!(await isInformesUnlocked())) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <InformesGate />
      </div>
    )
  }

  const sb = supabase as any

  // Traer pedidos + restaurantes + stock en paralelo (son independientes
  // entre sí). Excluimos cancelados. El coste (cost_price) se añade al
  // join de productos para poder calcular márgenes sin tocar la forma
  // de "lines" que ya usan las pestañas existentes — solo se le suma un
  // campo más.
  const [{ data: orders }, { data: restaurants }, { data: stock }, { data: returnNotes }, { data: fixedCosts }] = await Promise.all([
    sb
      .from('orders')
      .select(`
        id, order_number, created_at, total_price, restaurant_id, status,
        organizations!restaurant_id(id, name),
        order_items(id, product_id, quantity, rectified_quantity, unit, unit_price, total_price,
          products(name, cost_price, iva_rate, category_id, product_categories!products_category_id_fkey(name, color))
        )
      `)
      .neq('status', 'cancelado')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    sb
      .from('organizations')
      .select('id, name')
      .eq('type', 'restaurante')
      .order('name'),
    sb
      .from('nave_inventory')
      .select('product_id, current_stock, min_stock'),
    // Devoluciones: se modelan como delivery_notes type='devolucion'. Se
    // trae por separado porque cuelga de delivery_notes → orders, no de
    // order_items directamente.
    sb
      .from('delivery_notes')
      .select(`
        id, created_at, order_id,
        orders!inner(restaurant_id, organizations!restaurant_id(name)),
        delivery_note_items(product_id, delivered_quantity, unit, unit_price, total_price, return_reason,
          products(name)
        )
      `)
      .eq('type', 'devolucion'),
    sb
      .from('nave_fixed_costs')
      .select('id, category, name, monthly_amount, active')
      .order('category')
      .order('name'),
  ])

  // Costes (fijos/variables) de nave y restaurantes, ventas mensuales de cada
  // restaurante, y datos de situación (pedidos por preparar, id de la nave).
  // Todo va por la service role (las tablas no tienen políticas RLS) y esta
  // página ya está limitada a la nave. Si las tablas aún no existen, se
  // devuelve vacío en vez de romper Informes.
  const admin = createAdminClient() as any
  const [costRes, salesRes, pendingRes, naveRes] = await Promise.all([
    admin.from('org_cost_items').select('id, organization_id, kind, mode, name, value, active').order('created_at'),
    admin.from('restaurant_monthly_sales').select('organization_id, month, amount'),
    sb.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pendiente', 'en_preparacion', 'hecho', 'listo']).is('deleted_at', null),
    sb.from('organizations').select('id').eq('type', 'nave').limit(1).maybeSingle(),
  ])
  const costItems = (costRes.data ?? []).map((c: any) => ({ ...c, value: Number(c.value) }))
  const monthlySales = (salesRes.data ?? []).map((m: any) => ({ organization_id: m.organization_id, month: String(m.month).slice(0, 10), amount: Number(m.amount) }))
  const pendingOrders = pendingRes.count ?? 0
  // Stock agotado / bajo SOLO de productos activos (nave_inventory guarda también filas de productos archivados).
  const { data: activeStock } = await sb
    .from('nave_inventory')
    .select('current_stock, min_stock, products!inner(is_active, deleted_at)')
    .eq('products.is_active', true)
    .is('products.deleted_at', null)
  const stockOut = (activeStock ?? []).filter((r: any) => Number(r.current_stock) === 0).length
  const stockLow = (activeStock ?? []).filter((r: any) => Number(r.current_stock) > 0 && Number(r.min_stock) > 0 && Number(r.current_stock) <= Number(r.min_stock)).length
  const naveOrgId = naveRes.data?.id ?? null

  // Aplanar a filas por línea de pedido (para cálculos granulares)
  type Line = {
    order_id: string; order_number: number; created_at: string
    restaurant_id: string; restaurant_name: string
    product_id: string; product_name: string
    quantity: number; unit: string; unit_price: number
    item_total: number; order_total: number
    cost_price: number; iva_rate: number
    category_name: string | null; category_color: string | null
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
        category_name: (item.products as any)?.product_categories?.name ?? null,
        category_color: (item.products as any)?.product_categories?.color ?? null,
      })
    }
  }

  const stockRows = (stock ?? []).map((s: any) => ({
    product_id: s.product_id,
    current_stock: Number(s.current_stock),
    min_stock: Number(s.min_stock),
  }))

  // Aplanar devoluciones a filas por línea, igual que los pedidos
  type ReturnLine = {
    created_at: string; restaurant_id: string; restaurant_name: string
    product_id: string; product_name: string
    quantity: number; unit: string; total_price: number
    reason: 'reutilizable' | 'no_utilizable'
  }
  const returns: ReturnLine[] = []
  for (const n of returnNotes ?? []) {
    const order = (n as any).orders
    for (const item of (n as any).delivery_note_items ?? []) {
      if (!item.return_reason) continue
      returns.push({
        created_at: n.created_at,
        restaurant_id: order?.restaurant_id ?? '',
        restaurant_name: order?.organizations?.name ?? 'Desconocido',
        product_id: item.product_id,
        product_name: item.products?.name ?? 'Producto eliminado',
        quantity: Number(item.delivered_quantity),
        unit: item.unit,
        total_price: Number(item.total_price),
        reason: item.return_reason,
      })
    }
  }

  const fixedCostRows = (fixedCosts ?? []).map((c: any) => ({
    id: c.id, category: c.category, name: c.name,
    monthly_amount: Number(c.monthly_amount), active: c.active,
  }))

  return (
    <EstadisticasClient
      lines={lines}
      restaurants={restaurants ?? []}
      stockRows={stockRows}
      returns={returns}
      fixedCosts={fixedCostRows}
      costItems={costItems}
      monthlySales={monthlySales}
      pendingOrders={pendingOrders}
      stockAlerts={{ out: stockOut, low: stockLow }}
      naveOrgId={naveOrgId}
    />
  )
}
