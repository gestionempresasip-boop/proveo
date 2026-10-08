import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '../[id]/PrintButton'
import { AlbaranDocument } from '@/components/delivery-notes/AlbaranDocument'
import { requireArea } from '@/lib/areaGuard'

type SP = { desde?: string; hasta?: string; restaurante?: string; tipo?: string; resumen?: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/
const madridDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const eur = (n: number) => `${n < 0 ? '− ' : ''}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export default async function ImprimirAlbaranesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('albaranes')
  const sp = await searchParams
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const isAdmin = profile.role === 'admin'

  const desde = sp.desde && ISO.test(sp.desde) ? sp.desde : null
  const hasta = sp.hasta && ISO.test(sp.hasta) ? sp.hasta : null
  const tipo = sp.tipo === 'entrega' || sp.tipo === 'devolucion' ? sp.tipo : 'todos'
  const withSummary = sp.resumen !== '0'

  const back = (
    <Link href="/albaranes" className="flex items-center gap-2 text-sm text-gray-700 hover:text-black">
      <ArrowLeft className="w-4 h-4" /> Volver a albaranes
    </Link>
  )

  if (!desde || !hasta || desde > hasta) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {back}
        <p className="text-gray-700">Elige un rango de fechas válido (desde, hasta) en la pantalla de albaranes.</p>
      </div>
    )
  }

  const sb = (await createClient()) as any
  // Se pide con un día de margen por cada lado y se filtra después por el día
  // en hora de Madrid, para que el 1 de octubre empiece a las 00:00 de España.
  const from = new Date(new Date(`${desde}T00:00:00Z`).getTime() - 86400000).toISOString()
  const to = new Date(new Date(`${hasta}T00:00:00Z`).getTime() + 2 * 86400000).toISOString()

  let query = sb
    .from('delivery_notes')
    .select(`
      *,
      orders(order_number, total_price, notes, created_at, destination, restaurant_id,
        organizations(name, address, phone, email)
      ),
      delivery_note_items(*, products(name, unit, iva_rate))
    `)
    .gte('delivered_at', from)
    .lte('delivered_at', to)
    .order('delivered_at', { ascending: true })
    .order('note_number', { ascending: true })

  if (!isNave && !isAdmin) query = query.eq('orders.restaurant_id', profile.organization_id)

  const { data } = await query
  const notes = (data ?? []).filter((n: any) => {
    if (!n.orders) return false
    const day = madridDay(n.delivered_at)
    if (day < desde || day > hasta) return false
    if (tipo === 'entrega' && n.type === 'devolucion') return false
    if (tipo === 'devolucion' && n.type !== 'devolucion') return false
    if (isNave && sp.restaurante && sp.restaurante !== 'todos' && n.orders.organizations?.name !== sp.restaurante) return false
    return true
  })

  const amount = (n: any) =>
    n.type === 'devolucion'
      ? -(n.delivery_note_items ?? []).reduce((s: number, i: any) => s + Number(i.delivered_quantity) * Number(i.unit_price), 0)
      : Number(n.orders?.total_price ?? 0)
  const total = notes.reduce((s: number, n: any) => s + amount(n), 0)

  const byRestaurant = new Map<string, { count: number; amount: number }>()
  for (const n of notes) {
    const name = n.orders.organizations?.name ?? 'Restaurante'
    const g = byRestaurant.get(name) ?? { count: 0, amount: 0 }
    g.count += 1
    g.amount += amount(n)
    byRestaurant.set(name, g)
  }

  const rangeText = desde === hasta ? fmtDay(desde) : `${fmtDay(desde)} – ${fmtDay(hasta)}`

  return (
    <div className="p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-6 print:hidden">
        {back}
        {notes.length > 0 && <PrintButton />}
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-20 text-gray-700">
          <p className="font-medium">No hay albaranes entre el {fmtDay(desde)} y el {fmtDay(hasta)}</p>
          <p className="text-sm mt-1 text-gray-600">Prueba con otro rango o quita el filtro de restaurante o tipo.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-700 mb-4 print:hidden">
            {notes.length} {notes.length !== 1 ? 'albaranes' : 'albarán'} · {rangeText}. Se imprime uno por hoja
            {withSummary ? ', con una hoja resumen al principio' : ''}.
          </p>

          {withSummary && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6 print:shadow-none print:rounded-none print:border-none print:p-6 print:mb-0 print:break-after-page">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-[#1E2B28]">Proveo</h1>
                  <p className="text-sm text-gray-600 mt-1">Nave Obrador Central</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-black">Resumen de albaranes</p>
                  <p className="text-sm text-gray-700 mt-1">{rangeText}</p>
                  {isNave && sp.restaurante && sp.restaurante !== 'todos' && <p className="text-sm text-gray-700">{sp.restaurante}</p>}
                </div>
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b-2 border-[#1E2B28]">
                    <th className="text-left py-2 font-semibold text-black">Albarán</th>
                    <th className="text-left py-2 font-semibold text-black">Fecha</th>
                    <th className="text-left py-2 font-semibold text-black">Pedido</th>
                    {isNave && <th className="text-left py-2 font-semibold text-black">Restaurante</th>}
                    <th className="text-right py-2 font-semibold text-black">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n: any) => (
                    <tr key={n.id} className="border-b border-gray-100">
                      <td className="py-2">#{n.note_number}{n.type === 'devolucion' ? ' (devolución)' : ''}</td>
                      <td className="py-2 text-gray-700">{fmtDay(madridDay(n.delivered_at))}</td>
                      <td className="py-2 text-gray-700">#{n.orders.order_number}</td>
                      {isNave && <td className="py-2 text-gray-700">{n.orders.organizations?.name}</td>}
                      <td className="py-2 text-right font-medium">{eur(amount(n))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1E2B28]">
                    <td colSpan={isNave ? 4 : 3} className="py-2 font-bold text-black">TOTAL · {notes.length} {notes.length !== 1 ? 'albaranes' : 'albarán'}</td>
                    <td className="py-2 text-right font-bold text-black">{eur(total)}</td>
                  </tr>
                </tfoot>
              </table>

              {isNave && byRestaurant.size > 1 && (
                <>
                  <p className="text-xs text-gray-600 uppercase font-medium mb-2">Por restaurante</p>
                  <table className="w-full text-sm max-w-md">
                    <tbody>
                      {[...byRestaurant.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([name, g]) => (
                        <tr key={name} className="border-b border-gray-100">
                          <td className="py-1.5">{name}</td>
                          <td className="py-1.5 text-gray-600">{g.count} {g.count !== 1 ? 'albaranes' : 'albarán'}</td>
                          <td className="py-1.5 text-right font-medium">{eur(g.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {notes.map((n: any, i: number) => (
            <div key={n.id} className={`mb-6 print:mb-0 ${i < notes.length - 1 ? 'print:break-after-page' : ''}`}>
              <AlbaranDocument note={n} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
