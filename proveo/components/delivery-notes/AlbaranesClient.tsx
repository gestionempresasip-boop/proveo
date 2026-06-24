'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Printer, Trash2 } from 'lucide-react'
import { deleteDeliveryNote } from '@/app/actions/orders'

type Note = {
  id: string
  note_number: number
  delivered_at: string
  orders: {
    order_number: number
    total_price: number
    restaurant_id: string
    organizations: { name: string } | null
  } | null
}

function NoteRow({ note, isNave, onDeleted }: { note: Note; isNave: boolean; onDeleted: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await deleteDeliveryNote(note.id)
    onDeleted(note.id)
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#1E2B28] shrink-0" />
          <span className="font-medium text-black">#{note.note_number}</span>
          <span className="text-gray-600 text-xs">Pedido #{note.orders?.order_number}</span>
        </div>
      </td>
      {isNave && (
        <td className="px-4 py-3 text-gray-600">
          {note.orders?.organizations?.name ?? '—'}
        </td>
      )}
      <td className="px-4 py-3 text-gray-700">
        {new Date(note.delivered_at).toLocaleDateString('es-ES', {
          day: 'numeric', month: 'short', year: 'numeric'
        })}
      </td>
      {isNave && (
        <td className="px-4 py-3 text-right font-bold text-[#1E2B28]">
          {Number(note.orders?.total_price ?? 0).toFixed(2)} €
        </td>
      )}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/albaranes/${note.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E2B28] hover:underline"
          >
            <Printer className="w-3.5 h-3.5" />
            Ver / Imprimir
          </Link>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors ml-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">¿Eliminar?</span>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : 'Sí'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export function AlbaranesClient({ notes: initialNotes, isNave }: { notes: Note[]; isNave: boolean }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)

  function handleDeleted(id: string) { setNotes(prev => prev.filter(n => n.id !== id)) }

  if (notes.length === 0) {
    return (
      <div className="text-center py-20 text-gray-600">
        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium">No hay albaranes todavía</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Albarán</th>
              {isNave && <th className="text-left px-4 py-3 text-gray-700 font-medium">Restaurante</th>}
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Fecha</th>
              {isNave && <th className="text-right px-4 py-3 text-gray-700 font-medium">Total</th>}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {notes.map(note => (
              <NoteRow key={note.id} note={note} isNave={isNave} onDeleted={handleDeleted} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
