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
  const isReturn = note.type === 'devolucion'
  const returnTotal = items.reduce((s: number, i: any) => s + Number(i.delivered_quantity) * Number(i.unit_price), 0)

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
        <Link href="/albaranes" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Volver a albaranes
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 print:shadow-none print:rounded-none print:border-none print:p-6">
        {/* Cabecera */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1E2B28]">Proveo</h1>
            <p className="text-sm text-gray-600 mt-1">Nave Obrador Central</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-black">
              {isReturn ? 'Albarán de devolución' : 'Albarán'} #{note.note_number}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {new Date(note.delivered_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Destinatario */}
        <div className="bg-gray-50 rounded-xl p-4 mb-8">
          <p className="text-xs text-gray-600 uppercase font-medium mb-2">Destinatario</p>
          <p className="font-semibold text-black">{restaurant?.name ?? 'Restaurante'}</p>
          {restaurant?.phone && <p className="text-sm text-gray-700">{restaurant.phone}</p>}
          <p className="text-sm text-gray-600 mt-1">Pedido #{order?.order_number}</p>
        </div>

        {/* Líneas */}
        {isReturn ? (
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b-2 border-amber-600">
                <th className="text-left py-2 font-semibold text-black">Producto</th>
                <th className="text-right py-2 font-semibold text-black">Cantidad devuelta</th>
                <th className="text-left py-2 font-semibold text-black pl-4">Motivo</th>
                {showPrices && <th className="text-right py-2 font-semibold text-black">Importe</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2.5">
                    {item.products?.name}
                    {item.lot_number && (
                      <span className="block text-xs text-gray-600 mt-0.5">Lote: {item.lot_number}</span>
                    )}
                  </td>
                  <td className="text-right py-2.5 font-medium">{item.delivered_quantity} {unitLabel(item.unit)}</td>
                  <td className="py-2.5 pl-4">
                    {item.return_reason === 'reutilizable' ? (
                      <span className="text-green-700 font-medium">↩ Error de pedido / no se necesita — repuesto a stock</span>
                    ) : (
                      <span className="text-red-600 font-medium">🚫 Mal estado / no utilizable — no repuesto</span>
                    )}
                  </td>
                  {showPrices && <td className="text-right py-2.5 font-semibold">{(Number(item.delivered_quantity) * Number(item.unit_price)).toFixed(2)} €</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-[#1E2B28]">
              <th className="text-left py-2 font-semibold text-black">Producto</th>
              <th className="text-right py-2 font-semibold text-black">Pedido</th>
              <th className="text-right py-2 font-semibold text-black">Enviado</th>
              {showPrices && <th className="text-right py-2 font-semibold text-black">Base imp.</th>}
              {showPrices && <th className="text-right py-2 font-semibold text-black">IVA %</th>}
              {showPrices && <th className="text-right py-2 font-semibold text-black">Cuota IVA</th>}
              {showPrices && <th className="text-right py-2 font-semibold text-black">Total</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const isCanceled = Number(item.delivered_quantity) === 0
              const ivaRate = Number(item.products?.iva_rate) || 0
              const total = Number(item.total_price)
              const base = total / (1 + ivaRate)
              const ivaAmount = total - base
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2.5">
                    {item.products?.name}
                    {item.lot_number && (
                      <span className="block text-xs text-gray-600 mt-0.5">Lote: {item.lot_number}</span>
                    )}
                    {isCanceled && (
                      <span className="block text-xs text-red-600 font-medium mt-0.5">
                        ❌ Cancelado{item.note ? ` — ${item.note}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="text-right py-2.5 text-gray-700">{item.ordered_quantity} {unitLabel(item.unit)}</td>
                  <td className="text-right py-2.5 font-medium">
                    {item.delivered_quantity} {unitLabel(item.unit)}
                    {item.actual_weight != null && (
                      <span className="block text-xs text-gray-600 font-normal">({Number(item.actual_weight).toFixed(2)} kg)</span>
                    )}
                  </td>
                  {showPrices && <td className="text-right py-2.5 text-gray-700">{base.toFixed(2)} €</td>}
                  {showPrices && <td className="text-right py-2.5 text-gray-700">{Math.round(ivaRate * 100)}%</td>}
                  {showPrices && <td className="text-right py-2.5 text-gray-700">{ivaAmount.toFixed(2)} €</td>}
                  {showPrices && <td className="text-right py-2.5 font-semibold">{total.toFixed(2)} €</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        )}

        {/* Total devolución */}
        {isReturn && showPrices && (
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-md flex justify-between items-baseline pt-2 border-t-2 border-amber-600">
              <span className="font-bold text-black">TOTAL DEVUELTO</span>
              <span className="font-bold text-xl text-amber-700">− {returnTotal.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Desglose de IVA — solo nave, solo en albaranes de entrega */}
        {showPrices && !isReturn && (
          <div className="mb-8">
            <p className="text-xs text-gray-600 uppercase font-medium mb-2">Desglose de IVA</p>
            <table className="w-full text-sm max-w-md ml-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 font-medium text-gray-700">Tipo IVA</th>
                  <th className="text-right py-1.5 font-medium text-gray-700">Base imponible</th>
                  <th className="text-right py-1.5 font-medium text-gray-700">Cuota IVA</th>
                </tr>
              </thead>
              <tbody>
                {[...ivaGroups.entries()].sort((a, b) => a[0] - b[0]).map(([rate, g]) => (
                  <tr key={rate} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{Math.round(rate * 100)}%</td>
                    <td className="text-right py-1.5 text-gray-600">{g.base.toFixed(2)} €</td>
                    <td className="text-right py-1.5 text-gray-600">{g.iva.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="py-1.5 font-medium text-black">Total</td>
                  <td className="text-right py-1.5 font-medium text-black">{baseImponible.toFixed(2)} €</td>
                  <td className="text-right py-1.5 font-medium text-black">{totalIva.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
            <div className="flex justify-end mt-2">
              <div className="w-full max-w-md flex justify-between items-baseline pt-2 border-t-2 border-[#1E2B28]">
                <span className="font-bold text-black">TOTAL (base + IVA)</span>
                <span className="font-bold text-xl text-[#1E2B28]">{Number(order?.total_price ?? 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        {order?.notes && (
          <div className="border-t border-gray-100 pt-4 mb-6">
            <p className="text-xs text-gray-600 uppercase font-medium mb-1">Notas</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between text-xs text-gray-600">
          <p>Conforme recepción: ____________________</p>
          <p>Firma y sello</p>
        </div>
      </div>
    </div>
  )
}
