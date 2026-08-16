'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { listOrderMessages, sendOrderMessage, type OrderMessage } from '@/app/actions/orderChat'

// Sin Supabase Realtime todavía en esta app — se refresca solo, cada 6s,
// mientras el chat esté abierto (igual criterio que en Programación, solo
// que más corto porque aquí "inmediato" importa más).
const POLL_MS = 6000

export function OrderChat({ orderId, currentUserId }: { orderId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  async function fetchMessages() {
    try {
      const list = await listOrderMessages(orderId)
      setMessages(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    const id = setInterval(fetchMessages, POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBody('')
    const optimistic: OrderMessage = {
      id: `temp-${Date.now()}`, senderId: currentUserId, senderName: 'Tú',
      senderOrgType: 'nave', body: text, createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    startTransition(async () => {
      try {
        await sendOrderMessage(orderId, text)
      } finally {
        fetchMessages()
      }
    })
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 flex flex-col overflow-hidden">
      <div ref={containerRef} className="max-h-72 overflow-y-auto px-3 py-2.5 space-y-2">
        {loading ? (
          <p className="text-center text-xs text-gray-500 py-3">Cargando chat...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-500 py-3 flex items-center justify-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> Sin mensajes todavía
          </p>
        ) : (
          messages.map(m => {
            const mine = m.senderId === currentUserId
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${mine ? 'bg-[#1E2B28] text-white rounded-br-sm' : 'bg-white border border-gray-200 text-black rounded-bl-sm'}`}>
                  {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.senderName ?? 'Nave'}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex items-center gap-2 p-2 border-t border-gray-100 bg-white">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="w-9 h-9 rounded-xl bg-[#A8793A] hover:bg-[#8C6430] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
