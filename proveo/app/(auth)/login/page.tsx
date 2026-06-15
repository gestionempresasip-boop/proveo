'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Delete } from 'lucide-react'

const PLACES = [
  { name: 'Nave Obrador', email: 'admin@proveo.es', type: 'nave' as const },
  { name: 'Barranco Playa', email: 'barrancoplaya@proveo.es', type: 'restaurante' as const },
  { name: 'Va Bene Cala', email: 'vabenecala@proveo.es', type: 'restaurante' as const },
  { name: 'Va Bene Centro', email: 'vabenecentro@proveo.es', type: 'restaurante' as const },
  { name: 'Aruba', email: 'aruba@proveo.es', type: 'restaurante' as const },
  { name: 'Conbrassa', email: 'conbrassa@proveo.es', type: 'restaurante' as const },
  { name: 'Season', email: 'season@proveo.es', type: 'restaurante' as const },
]

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
const PIN_PREFIX = 'pvprveo'

export default function LoginPage() {
  const [selected, setSelected] = useState<(typeof PLACES)[0] | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleSelect(place: (typeof PLACES)[0]) {
    setSelected(place)
    setPin('')
    setError(null)
  }

  function handleKey(key: string) {
    if (key === 'del') {
      setPin((p) => p.slice(0, -1))
      setError(null)
      return
    }
    if (pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) {
      doLogin(next)
    }
  }

  async function doLogin(pinValue: string) {
    if (!selected) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: selected.email,
      password: PIN_PREFIX + pinValue,
    })
    if (error) {
      setError('PIN incorrecto')
      setPin('')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1B4332] mb-4 shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1B4332] tracking-tight">Proveo</h1>
          <p className="text-gray-400 mt-1 text-sm">Selecciona tu restaurante</p>
        </div>

        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {PLACES.map((place) => (
            <button
              key={place.email}
              onClick={() => handleSelect(place)}
              className={`
                flex flex-col items-center justify-center gap-2
                rounded-2xl border-2 p-5 font-semibold text-sm
                transition-all duration-150 active:scale-95 shadow-sm
                ${place.type === 'nave'
                  ? 'col-span-2 bg-[#1B4332] text-white border-[#1B4332] hover:bg-[#163828]'
                  : 'bg-white text-[#1C1C1E] border-gray-100 hover:border-[#1B4332] hover:shadow-md'
                }
              `}
            >
              <span className="text-2xl">{place.type === 'nave' ? '🏭' : '🍽️'}</span>
              {place.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <button
          onClick={() => { setSelected(null); setPin('') }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1B4332] mb-4 shadow-lg">
            <span className="text-3xl">{selected.type === 'nave' ? '🏭' : '🍽️'}</span>
          </div>
          <h2 className="text-xl font-bold text-[#1C1C1E]">{selected.name}</h2>
          <p className="text-gray-400 text-sm mt-1">Introduce tu PIN</p>
        </div>

        {/* Puntos del PIN */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > i
                  ? 'bg-[#1B4332] border-[#1B4332] scale-110'
                  : 'bg-transparent border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-red-500 text-sm mb-4 font-medium">{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {NUMPAD.map((key, i) => {
            if (key === '') return <div key={i} />
            if (key === 'del') {
              return (
                <button
                  key={i}
                  onClick={() => handleKey('del')}
                  disabled={loading}
                  className="flex items-center justify-center h-16 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-500 disabled:opacity-40"
                >
                  <Delete className="w-5 h-5" />
                </button>
              )
            }
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={loading || pin.length >= 4}
                className="flex items-center justify-center h-16 rounded-2xl bg-white border border-gray-100 hover:border-[#1B4332] hover:shadow-md active:scale-95 transition-all text-xl font-semibold text-[#1C1C1E] shadow-sm disabled:opacity-40"
              >
                {key}
              </button>
            )
          })}
        </div>

        {loading && (
          <p className="text-center text-sm text-gray-400 mt-6 animate-pulse">Entrando...</p>
        )}
      </div>
    </div>
  )
}
