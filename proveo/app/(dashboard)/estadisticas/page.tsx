import { getAuthProfile } from '@/lib/supabase/helpers'
import { BarChart2, TrendingUp, Package, ShoppingCart } from 'lucide-react'

export default async function EstadisticasPage() {
  await getAuthProfile()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">Estadísticas</h1>
        <p className="text-gray-500 mt-1">Resumen de actividad y consumo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pedidos este mes', value: '—', icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
          { label: 'Productos más pedidos', value: '—', icon: Package, color: 'bg-green-50 text-green-600' },
          { label: 'Gasto total mes', value: '—', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'Alertas de stock', value: '—', icon: BarChart2, color: 'bg-red-50 text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-[#1C1C1E]">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Gráficas en desarrollo</p>
        <p className="text-sm text-gray-400 mt-1">
          Próximamente: consumo por restaurante, productos más pedidos y evolución mensual
        </p>
      </div>
    </div>
  )
}
