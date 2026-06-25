import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { FileText } from 'lucide-react'
import { AlbaranesClient } from '@/components/delivery-notes/AlbaranesClient'

export default async function AlbaranesPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  let query = sb
    .from('delivery_notes')
    .select('*, orders(order_number, total_price, restaurant_id, organizations(name)), delivery_note_items(delivered_quantity, unit_price, return_reason)')
    .order('delivered_at', { ascending: false })

  if (!isNave && profile.role !== 'admin') {
    query = query.eq('orders.restaurant_id', profile.organization_id)
  }

  const { data: notes } = await query
  const validNotes = (notes ?? []).filter((n: any) => n.orders)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Albaranes</h1>
        <p className="text-gray-700 mt-1">
          {isNave
            ? 'Albaranes generados al marcar pedidos como enviados'
            : 'Albaranes recibidos de la nave'}
        </p>
      </div>

      {validNotes.length === 0 && (
        <div className="text-center py-6 text-gray-700 text-sm">
          {isNave
            ? 'Se generan automáticamente al marcar un pedido como enviado'
            : 'Aparecerán aquí cuando la nave envíe tus pedidos'}
        </div>
      )}
      <AlbaranesClient notes={validNotes} isNave={isNave} />
    </div>
  )
}
