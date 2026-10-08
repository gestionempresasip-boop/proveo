'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

// Pantalla de código de acceso (Costes, Producción…). La comprobación la hace el servidor.
export function CodeGate({ title, description, configured, envName, unlock }: {
  title: string
  description: string
  configured: boolean
  envName: string
  unlock: (code: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    const res = await unlock(code)
    setBusy(false)
    if (res.ok) router.refresh()
    else { setError(res.error ?? 'Código incorrecto'); setCode('') }
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto pt-16">
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-amber-700" /></div>
          <div>
            <h1 className="font-bold text-black text-lg leading-tight">{title}</h1>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        {!configured ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Todavía no hay ningún código configurado en el servidor (falta <code>{envName}</code>).
          </p>
        ) : (
          <>
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Código de acceso"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <button type="submit" disabled={busy || !code.trim()} className="w-full rounded-xl bg-[#1E2B28] text-white font-semibold py-3 hover:bg-[#141F1C] disabled:opacity-50">
              {busy ? 'Comprobando…' : 'Entrar'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
