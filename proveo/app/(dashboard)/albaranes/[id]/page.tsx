import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

export default async function AlbaranDetailPage({ params }: { params: { id: string } }) {
  await getAuthProfile()
  const supabase = await createClient()
  const sb = supabase as any

  const { data: note } = await sb
    .from('delivery_notes')
    .select(`
      *,
      orders(order_number, total_price, notes, created_at,
        organizations(name, address, phone, email)
      ),
      delivery_note_items(*, products(name, unit))
    `)
    .eq('id', params.id)
    .single()

  if (!note) notFound()

  const order = note.orders
  const restaurant = order?.organizations
  const items = note.delivery_note_items ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/albaranes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Volver a albaranes
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#1B4332] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163828]"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento imprimible */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 print:shadow-none print:rounded-none print:border-none">
        {/* Cabecera */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1B4332]">Proveo</h1>
            <p className="text-sm text-gray-400 mt-1">Nave Obrador Central</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#1C1C1E]">Albarán #{note.note_number}</p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(note.delivered_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Destinatario */}
        <div className="bg-gray-50 rounded-xl p-4 mb-8">
          <p className="text-xs text-gray-400 uppercase font-medium mb-2">Destinatario</p>
          <p className="font-semibold text-[#1C1C1E]">{restaurant?.name ?? 'Restaurante'}</p>
          {restaurant?.address && <p className="text-sm text-gray-500">{restaurant.address}</p>}
          {restaurant?.phone && <p className="text-sm text-gray-500">{restaurant.phone}</p>}
          <p className="text-sm text-gray-400 mt-1">Pedido #{order?.order_number}</p>
        </div>

        {/* Líneas */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-[#1B4332]">
              <th className="text-left py-2 font-semibold text-[#1C1C1E]">Producto</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Pedido</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Enviado</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Precio/u</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2.5">{item.products?.name}</td>
                <td className="text-right py-2.5 text-gray-500">{item.ordered_quantity} {item.unit}</td>
                <td className="text-right py-2.5 font-medium">{item.delivered_quantity} {item.unit}</td>
                <td className="text-right py-2.5">{Number(item.unit_price).toFixed(2)} €</td>
                <td className="text-right py-2.5 font-semibold">{Number(item.total_price).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right pt-4 font-bold text-[#1C1C1E]">TOTAL</td>
              <td className="text-right pt-4 font-bold text-xl text-[#1B4332]">
                {Number(order?.total_price ?? 0).toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>

        {order?.notes && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notas</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <p>Conforme recepción: ____________________</p>
          <p>Firma y sello</p>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(.print-root) { display: none; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
