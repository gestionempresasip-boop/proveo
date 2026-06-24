import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from './PrintButton'
import { unitLabel } from '@/lib/units'

export default async function AlbaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getAuthProfile()
  const showPrices = profile.organizations.type === 'nave'
  const { id } = await params

  const supabase = await createClient()
  const sb = supabase as any

  const { data: note } = await sb
    .from('delivery_notes')
    .select(`
      *,
      orders(order_number, total_price, notes, created_at,
        organizations(name, address, phone, email)
      ),
      delivery_note_items(*, products(name, unit, iva_rate))
    `)
    .eq('id', id)
    .single()

  if (!note) notFound()

  const order = note.orders
  const restaurant = order?.organizations
  const items = note.delivery_note_items ?? []

  // Desglose por tipo de IVA: cada línea ya incluye IVA en su total_price.
  // base = total / (1 + iva), iva_amount = total - base
  const ivaGroups = new Map<number, { base: number; iva: number }>()
  for (const item of items) {
    const ivaRate = Number(item.products?.iva_rate) || 0
    const total = Number(item.total_price)
    const base = total / (1 + ivaRate)
    const ivaAmount = total - base
    const g = ivaGroups.get(ivaRate) ?? { base: 0, iva: 0 }
    g.base += base
    g.iva += ivaAmount
    ivaGroups.set(ivaRate, g)
  }
  const baseImponible = [...ivaGroups.values()].reduce((s, g) => s + g.base, 0)
  const totalIva = [...ivaGroups.values()].reduce((s, g) => s + g.iva, 0)

  return (
    <div className="p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/albaranes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Volver a albaranes
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 print:shadow-none print:rounded-none print:border-none print:p-6">
        {/* Cabecera */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1E2B28]">Proveo</h1>
            <p className="text-sm text-gray-400 mt-1">Nave Obrador Central</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#1C1C1E]">Albarán #{note.note_number}</p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(note.delivered_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric',
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
            <tr className="border-b-2 border-[#1E2B28]">
              <th className="text-left py-2 font-semibold text-[#1C1C1E]">Producto</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Pedido</th>
              <th className="text-right py-2 font-semibold text-[#1C1C1E]">Enviado</th>
              {showPrices && <th className="text-right py-2 font-semibold text-[#1C1C1E]">Precio/u</th>}
              {showPrices && <th className="text-right py-2 font-semibold text-[#1C1C1E]">Total</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const isCanceled = Number(item.delivered_quantity) === 0
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2.5">
                    {item.products?.name}
                    {isCanceled && (
                      <span className="block text-xs text-red-600 font-medium mt-0.5">
                        ❌ Cancelado{item.note ? ` — ${item.note}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="text-right py-2.5 text-gray-500">{item.ordered_quantity} {unitLabel(item.unit)}</td>
                  <td className="text-right py-2.5 font-medium">{item.delivered_quantity} {unitLabel(item.unit)}</td>
                  {showPrices && <td className="text-right py-2.5">{Number(item.unit_price).toFixed(2)} €</td>}
                  {showPrices && <td className="text-right py-2.5 font-semibold">{Number(item.total_price).toFixed(2)} €</td>}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Desglose de IVA — solo nave */}
        {showPrices && (
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-xs space-y-1.5">
              {[...ivaGroups.entries()].sort((a, b) => a[0] - b[0]).map(([rate, g]) => (
                <div key={rate} className="flex justify-between text-sm text-gray-500">
                  <span>Base imponible (IVA {Math.round(rate * 100)}%)</span>
                  <span>{g.base.toFixed(2)} €</span>
                </div>
              ))}
              <div className="flex justify-between text-sm text-gray-500 pt-1 border-t border-gray-100">
                <span>Base imponible total</span>
                <span>{baseImponible.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>IVA</span>
                <span>{totalIva.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-[#1E2B28]">
                <span className="font-bold text-[#1C1C1E]">TOTAL</span>
                <span className="font-bold text-xl text-[#1E2B28]">{Number(order?.total_price ?? 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        {order?.notes && (
          <div className="border-t border-gray-100 pt-4 mb-6">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notas</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <p>Conforme recepción: ____________________</p>
          <p>Firma y sello</p>
        </div>
      </div>
    </div>
  )
}
