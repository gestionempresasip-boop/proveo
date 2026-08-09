'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Delete } from 'lucide-react'
import { unlockInformes } from '@/app/actions/informesGate'

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
const CODE_LENGTH = 6

export function InformesGate() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleKey(key: string) {
    if (loading) return
    if (key === 'del') {
      setCode(c => c.slice(0, -1))
      setError(null)
      return
    }
    if (code.length >= CODE_LENGTH) return
    const next = code + key
    setCode(next)
    if (next.length === CODE_LENGTH) submit(next)
  }

  async function submit(value: string) {
    setLoading(true)
    setError(null)
    const result = await unlockInformes(value)
    if (!result.ok) {
      setError(result.error ?? 'Código incorrecto')
      setCode('')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#1E2B28] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-black">Informes</h1>
          <p className="text-gray-600 text-sm mt-1">Introduce el código de acceso</p>
        </div>

        {/* Puntos del código */}
        <div className="flex justify-center gap-2.5 mb-8">
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                code.length > i ? 'bg-[#1E2B28] border-[#1E2B28] scale-110' : 'bg-transparent border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-red-500 text-sm mb-4 font-medium">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {NUMPAD.map((key, i) => {
            if (key === '') return <div key={i} />
            if (key === 'del') {
              return (
                <button
                  key={i}
                  onClick={() => handleKey('del')}
                  disabled={loading}
                  className="flex items-center justify-center h-16 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-700 disabled:opacity-40"
                >
                  <Delete className="w-5 h-5" />
                </button>
              )
            }
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={loading || code.length >= CODE_LENGTH}
                className="flex items-center justify-center h-16 rounded-2xl bg-white border border-gray-100 hover:border-[#1E2B28] hover:shadow-md active:scale-95 transition-all text-xl font-semibold text-black shadow-sm disabled:opacity-40"
              >
                {key}
              </button>
            )
          })}
        </div>

        {loading && (
          <p className="text-center text-sm text-gray-600 mt-6 animate-pulse">Comprobando...</p>
        )}
      </div>
    </div>
  )
}
