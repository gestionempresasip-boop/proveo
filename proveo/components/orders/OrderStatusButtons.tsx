'use client'

import { useState } from 'react'
import { updateOrderStatus } from '@/app/actions/orders'
import type { OrderStatus } from '@/app/actions/orders'

function normalize(s: string): string {
  if (s === 'en_preparacion' || s === 'listo') return 'hecho'
  if (s === 'entregado') return 'enviado'
  return s
}

const NEXT: Record<string, { label: string; next: OrderStatus; color: string }> = {
  pendiente: { label: 'Marcar como hecho',   next: 'hecho',   color: 'bg-blue-600 hover:bg-blue-700' },
  hecho:     { label: 'Marcar como enviado', next: 'enviado', color: 'bg-[#1B4332] hover:bg-[#163828]' },
}

export function OrderStatusButtons({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false)
  const action = NEXT[normalize(currentStatus)]

  if (!action) return null

  async function handleClick() {
    setLoading(true)
    try { await updateOrderStatus(orderId, action.next) }
    finally { setLoading(false) }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${action.color}`}
    >
      {loading ? 'Actualizando...' : action.label}
    </button>
  )
}
