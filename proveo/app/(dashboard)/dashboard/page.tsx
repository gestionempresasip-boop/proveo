import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, Package, AlertTriangle, ClipboardList } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()

  const isNave = profile.organizations.type === 'nave'

  let pendingOrders = 0
  let totalProducts = 0
  let lowStockCount = 0

  const { count: ordersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendiente')
    .then(r => ({ count: r.count }))
  pendingOrders = ordersCount ?? 0

  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .then(r => ({ count: r.count }))
  totalProducts = productsCount ?? 0

  type RecentOrder = {
    id: string; order_number: number; status: string
    total_price: number; created_at: string
    organizations: { name: string } | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawOrders } = await (supabase as any)
    .from('orders')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })
    .limit(5)
  const recentOrders = (rawOrders ?? []) as RecentOrder[]

  const statusColors: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    en_preparacion: 'bg-blue-100 text-blue-800',
    listo: 'bg-green-100 text-green-800',
    entregado: 'bg-gray-100 text-gray-600',
    cancelado: 'bg-red-100 text-red-800',
  }

  const statusLabels: Record<string, string> = {
    pendiente: 'Pendiente',
    en_preparacion: 'En preparación',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">
          Buenos días, {profile.full_name?.split(' ')[0] ?? 'bienvenido'} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {isNave ? 'Panel de la Nave Obrador' : `Panel de ${profile.organizations.name}`}
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {isNave ? 'Pedidos pendientes' : 'Mis pedidos pendientes'}
              </p>
              <p className="text-2xl font-bold text-[#1C1C1E]">{pendingOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Package className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Productos activos</p>
              <p className="text-2xl font-bold text-[#1C1C1E]">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Alertas de stock</p>
              <p className="text-2xl font-bold text-[#1C1C1E]">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos para restaurante */}
      {!isNave && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/catalogo">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-[#1B4332] rounded-2xl flex items-center justify-center group-hover:bg-[#F59E0B] transition-colors">
                  <ShoppingCart className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[#1C1C1E]">Hacer un pedido</p>
                  <p className="text-sm text-gray-500">Selecciona productos del catálogo</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/pedidos">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-[#1B4332] rounded-2xl flex items-center justify-center group-hover:bg-[#F59E0B] transition-colors">
                  <ClipboardList className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[#1C1C1E]">Ver mis pedidos</p>
                  <p className="text-sm text-gray-500">Historial y estado de pedidos</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Pedidos recientes */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isNave ? 'Últimos pedidos recibidos' : 'Mis últimos pedidos'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentOrders || recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No hay pedidos aún</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#1B4332] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">#{order.order_number}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C1C1E]">
                        {isNave ? (order.organizations as { name: string })?.name : `Pedido #${order.order_number}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#1C1C1E]">
                      {Number(order.total_price).toFixed(2)}€
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
