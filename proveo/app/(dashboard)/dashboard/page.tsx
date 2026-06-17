import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { ShoppingCart, ClipboardList, Package, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  pendiente:      'Pendiente',
  en_preparacion: 'En preparación',
  hecho:          'Hecho',
  listo:          'Listo',
  entregado:      'Enviado',
  enviado:        'Enviado',
  cancelado:      'Cancelado',
}

const STATUS_DOT: Record<string, string> = {
  pendiente:      'bg-amber-400',
  en_preparacion: 'bg-blue-400',
  hecho:          'bg-blue-400',
  listo:          'bg-emerald-400',
  entregado:      'bg-gray-300',
  enviado:        'bg-emerald-400',
  cancelado:      'bg-red-400',
}

function greeting(name?: string | null) {
  const hour = new Date().getHours()
  const saludo = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  return `${saludo}${name ? `, ${name.split(' ')[0]}` : ''}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  const [{ count: pendingCount }, { count: productsCount }, { data: recentOrders }] = await Promise.all([
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente'),
    sb.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('orders')
      .select('id, order_number, status, total_price, created_at, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const stats = [
    {
      label: isNave ? 'Pedidos pendientes' : 'Pedidos pendientes',
      value: pendingCount ?? 0,
      icon: <ClipboardList className="h-5 w-5" />,
      color: 'text-amber-600 bg-amber-50',
      href: '/pedidos',
    },
    {
      label: 'Productos disponibles',
      value: productsCount ?? 0,
      icon: <Package className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-50',
      href: isNave ? '/admin/productos' : '/catalogo',
    },
  ]

  const quickActions = isNave
    ? [
        { href: '/pedidos',   label: 'Ver pedidos entrantes', desc: 'Gestiona los pedidos de los restaurantes', icon: <ClipboardList className="h-6 w-6" /> },
        { href: '/albaranes', label: 'Albaranes',             desc: 'Historial de entregas y documentos',       icon: <FileText className="h-6 w-6" /> },
      ]
    : [
        { href: '/catalogo',  label: 'Hacer un pedido',  desc: 'Selecciona productos y envía tu pedido', icon: <ShoppingCart className="h-6 w-6" /> },
        { href: '/pedidos',   label: 'Mis pedidos',      desc: 'Consulta el estado de tus pedidos',      icon: <ClipboardList className="h-6 w-6" /> },
      ]

  return (
    <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {greeting(profile.full_name)}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {isNave ? 'Nave Obrador' : profile.organizations.name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map(s => (
          <Link key={s.href} href={s.href}>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map(action => (
          <Link key={action.href} href={action.href}>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all group">
              <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:bg-amber-400 transition-colors">
                <span className="text-white">{action.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{action.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{action.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {isNave ? 'Últimos pedidos' : 'Mis últimos pedidos'}
          </h2>
          <Link href="/pedidos" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Ver todos →
          </Link>
        </div>

        {!recentOrders || recentOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No hay pedidos aún
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order: any) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-gray-400 shrink-0">#{order.order_number}</span>
                  <span className="text-sm text-gray-700 font-medium truncate">
                    {isNave ? order.organizations?.name : `Pedido #${order.order_number}`}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
                    {new Date(order.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-gray-900">
                    {Number(order.total_price).toFixed(2)}€
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[order.status] ?? 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
