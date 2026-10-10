import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import Link from 'next/link'
import { AlbaranesClient } from '@/components/delivery-notes/AlbaranesClient'

// Por defecto solo los últimos 4 meses (antes se traían todos los albaranes
// de la historia en cada visita); ?todo=1 trae el histórico completo.
const RECENT_DAYS = 120

export default async function AlbaranesPage({ searchParams }: { searchParams: Promise<{ todo?: string }> }) {
  const { todo } = await searchParams
  const showAll = todo === '1'
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  let query = sb
    .from('delivery_notes')
    // Solo las columnas que usa la lista; las líneas del albarán únicamente hacen falta en las devoluciones (su importe sale de ellas)
    .select('id, note_number, delivered_at, type, orders(order_number, total_price, restaurant_id, organizations(name))')
    .order('delivered_at', { ascending: false })

  if (!showAll) {
    query = query.gte('delivered_at', new Date(Date.now() - RECENT_DAYS * 86400000).toISOString())
  }

  if (!isNave && profile.role !== 'admin') {
    query = query.eq('orders.restaurant_id', profile.organization_id)
  }

  const { data: notes } = await query
  const validNotes = (notes ?? []).filter((n: any) => n.orders)
  const returnIds = validNotes.filter((n: any) => n.type === 'devolucion').map((n: any) => n.id)
  if (returnIds.length > 0) {
    const { data: lines } = await sb
      .from('delivery_note_items')
      .select('delivery_note_id, delivered_quantity, unit_price, return_reason')
      .in('delivery_note_id', returnIds)
    const byNote = new Map<string, any[]>()
    for (const l of lines ?? []) (byNote.get(l.delivery_note_id) ?? byNote.set(l.delivery_note_id, []).get(l.delivery_note_id)!).push(l)
    for (const n of validNotes) if (n.type === 'devolucion') n.delivery_note_items = byNote.get(n.id) ?? []
  }

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

      <p className="text-center text-xs text-gray-600">
        {showAll ? (
          <Link href="/albaranes" className="underline">Ver solo los últimos 4 meses</Link>
        ) : (
          <>Mostrando los últimos 4 meses · <Link href="/albaranes?todo=1" className="underline font-medium text-[#1E2B28]">Ver todo el histórico</Link></>
        )}
      </p>
    </div>
  )
}
