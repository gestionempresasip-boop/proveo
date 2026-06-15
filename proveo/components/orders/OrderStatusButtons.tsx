'use client'

import { useState } from 'react'
import { updateOrderStatus } from '@/app/actions/orders'

const NEXT_STATUS: Record<string, { label: string; next: string; color: string }> = {
  pendiente:      { label: '👨‍🍳 Poner en preparación', next: 'en_preparacion', color: 'bg-blue-600 hover:bg-blue-700' },
  en_preparacion: { label: '✅ Marcar como listo',       next: 'listo',          color: 'bg-green-600 hover:bg-green-700' },
  listo:          { label: '📦 Marcar como enviado',     next: 'entregado',      color: 'bg-[#1B4332] hover:bg-[#163828]' },
}

export function OrderStatusButtons({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false)
  const action = NEXT_STATUS[currentStatus]

  if (!action) return null

  async function handleClick() {
    setLoading(true)
    try {
      await updateOrderStatus(orderId, action.next as any)
    } finally {
      setLoading(false)
    }
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
