import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { FileText, Printer, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default async function AlbaranesPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  let query = sb
    .from('delivery_notes')
    .select('*, orders(order_number, total_price, restaurant_id, organizations(name))')
    .order('delivered_at', { ascending: false })

  if (!isNave && profile.role !== 'admin') {
    query = query.eq('orders.restaurant_id', profile.organization_id)
  }

  const { data: notes } = await query
  const validNotes = (notes ?? []).filter((n: any) => n.orders)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">Albaranes</h1>
        <p className="text-gray-500 mt-1">
          {isNave
            ? 'Albaranes generados al marcar pedidos como enviados'
            : 'Albaranes recibidos de la nave'}
        </p>
      </div>

      {validNotes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No hay albaranes todavía</p>
          <p className="text-sm mt-1">
            {isNave
              ? 'Se generan automáticamente al marcar un pedido como enviado'
              : 'Aparecerán aquí cuando la nave envíe tus pedidos'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Albarán</th>
                {isNave && <th className="text-left px-4 py-3 text-gray-500 font-medium">Restaurante</th>}
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {validNotes.map((note: any) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#1B4332] shrink-0" />
                      <span className="font-medium text-[#1C1C1E]">
                        #{note.note_number}
                      </span>
                      <span className="text-gray-400 text-xs">
                        Pedido #{note.orders?.order_number}
                      </span>
                    </div>
                  </td>
                  {isNave && (
                    <td className="px-4 py-3 text-gray-600">
                      {note.orders?.organizations?.name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(note.delivered_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#1B4332]">
                    {Number(note.orders?.total_price ?? 0).toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/albaranes/${note.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4332] hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Ver / Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
