import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Download } from 'lucide-react'

export default async function AlbaranesPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()

  const isNave = profile.organizations.type === 'nave'

  type NoteWithOrder = {
    id: string
    note_number: number
    delivered_at: string
    pdf_url: string | null
    orders: { order_number: number; total_price: number; organizations: { name: string } } | null
  }

  let query = supabase
    .from('delivery_notes')
    .select('*, orders(order_number, total_price, organizations(name))')
    .order('delivered_at', { ascending: false })

  if (!isNave && profile.role !== 'admin') {
    query = query.filter('orders.restaurant_id', 'eq', profile.organization_id)
  }

  const { data: rawNotes } = await query
  const notes = (rawNotes ?? []) as unknown as NoteWithOrder[]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">Albaranes</h1>
        <p className="text-gray-500 mt-1">Albaranes de entrega generados</p>
      </div>

      {!notes || notes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay albaranes todavía</p>
          <p className="text-sm mt-1">Los albaranes se generan cuando la nave entrega un pedido</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const order = note.orders

            return (
              <Card key={note.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#d8f3dc] rounded-xl flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[#1B4332]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1C1C1E]">
                        Albarán #{note.note_number} — Pedido #{order?.order_number}
                      </p>
                      <p className="text-sm text-gray-400">
                        {isNave && order?.organizations?.name && `${order.organizations.name} · `}
                        {new Date(note.delivered_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-[#1B4332]">
                      {Number(order?.total_price ?? 0).toFixed(2)}€
                    </span>
                    {note.pdf_url && (
                      <a
                        href={note.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-[#1B4332] hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
