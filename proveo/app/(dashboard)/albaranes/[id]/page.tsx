import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from './PrintButton'
import { AlbaranDocument } from '@/components/delivery-notes/AlbaranDocument'
import { requireArea } from '@/lib/areaGuard'

export default async function AlbaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea('albaranes')
  await getAuthProfile()
  const { id } = await params

  const supabase = await createClient()
  const sb = supabase as any

  const { data: note } = await sb
    .from('delivery_notes')
    .select(`
      *,
      orders(order_number, total_price, notes, created_at, destination,
        organizations(name, address, phone, email)
      ),
      delivery_note_items(*, products(name, unit, iva_rate))
    `)
    .eq('id', id)
    .single()

  if (!note) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/albaranes" className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Volver a albaranes
        </Link>
        <PrintButton />
      </div>

      <AlbaranDocument note={note} />
    </div>
  )
}
