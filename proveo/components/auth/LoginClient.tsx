'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Delete } from 'lucide-react'
import { listLoginNaveUsers, loginNaveUser } from '@/app/actions/naveAccess'
import { FULL_ACCESS_LABEL } from '@/lib/areas'

const PLACES = [
  { name: 'Nave Obrador', email: 'admin@proveo.es', type: 'nave' as const, logo: '/logos/depot.png' },
  { name: 'Barranco Playa', email: 'barrancoplaya@proveo.es', type: 'restaurante' as const, logo: '/logos/barranco.png' },
  { name: 'Va Bene Cala', email: 'vabenecala@proveo.es', type: 'restaurante' as const, logo: '/logos/va-bene-cala.png' },
  { name: 'Va Bene Centro', email: 'vabenecentro@proveo.es', type: 'restaurante' as const, logo: '/logos/va-bene-centro.png' },
  { name: 'Aruba', email: 'aruba@proveo.es', type: 'restaurante' as const, logo: '/logos/aruba.png' },
  { name: 'Conbrassa', email: 'conbrassa@proveo.es', type: 'restaurante' as const, logo: '/logos/conbrassa.png' },
  { name: 'Season', email: 'season@proveo.es', type: 'restaurante' as const, logo: '/logos/season.png' },
]

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
const PIN_PREFIX = 'pvprveo'

type Person = { id: string; name: string }

export function LoginClient() {
  const [selected, setSelected] = useState<(typeof PLACES)[0] | null>(null)
  // La nave puede tener varios usuarios con nombre (creados por Gestión). Si solo existe Gestión,
  // se entra como siempre: tocar «Nave Obrador» y poner el PIN.
  const [people, setPeople] = useState<Person[] | null>(null)
  const [person, setPerson] = useState<Person | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSelect(place: (typeof PLACES)[0]) {
    setPin('')
    setError(null)
    if (place.type === 'nave') {
      setLoading(true)
      const list = await listLoginNaveUsers().catch(() => [] as Person[])
      setLoading(false)
      if (list.length > 1) { setPeople(list); return }
    }
    setSelected(place)
  }

  function handlePerson(p: Person) {
    setPerson(p)
    setSelected({ ...PLACES[0], name: p.name === FULL_ACCESS_LABEL ? 'Nave Obrador' : p.name })
    setPeople(null)
  }

  function goBack() {
    const wasPerson = !!person
    setSelected(null)
    setPin('')
    setError(null)
    if (wasPerson) {
      setPerson(null)
      void listLoginNaveUsers().then(setPeople).catch(() => setPeople(null))
    }
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
    let ok: boolean
    if (person) {
      ok = (await loginNaveUser(person.id, pinValue).catch(() => ({ ok: false }))).ok
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: selected.email, password: PIN_PREFIX + pinValue })
      ok = !error
    }
    if (!ok) {
      setError('PIN incorrecto')
      setPin('')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  if (people && !selected) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <button onClick={() => setPeople(null)} className="flex items-center gap-1 text-sm text-gray-600 mb-6">
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <div className="mb-6 text-center">
            <Image src={PLACES[0].logo} alt="Nave Obrador" width={160} height={48} className="w-full h-12 object-contain mb-3" />
            <h1 className="text-2xl font-bold text-[#1E2B28]">¿Quién eres?</h1>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {people.map(p => (
              <button key={p.id} onClick={() => handlePerson(p)} className="rounded-2xl border-2 border-gray-100 hover:border-[#1E2B28] bg-white shadow-sm px-4 py-5 text-lg font-bold text-black transition-all active:scale-[0.98] break-words">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-[#1E2B28] tracking-tight">Proveo</h1>
          <p className="text-gray-600 mt-1 text-sm">Selecciona tu restaurante</p>
        </div>

        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {PLACES.map((place) => (
            <button
              key={place.email}
              onClick={() => handleSelect(place)}
              className={`
                flex flex-col items-center justify-center gap-2
                rounded-2xl border-2 p-4 font-semibold text-sm
                transition-all duration-150 active:scale-95 shadow-sm bg-white
                ${place.type === 'nave'
                  ? 'col-span-2 border-[#A8793A]'
                  : 'border-gray-100 hover:border-[#1E2B28] hover:shadow-md'
                }
              `}
            >
              <Image
                src={place.logo}
                alt={place.name}
                width={160}
                height={48}
                className="w-full h-12 object-contain"
              />
              <span className="text-black">{place.name}</span>
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
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-600 mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src={selected.logo}
              alt={selected.name}
              width={200}
              height={64}
              className="w-24 h-16 object-contain"
            />
          </div>
          <h2 className="text-xl font-bold text-black">{selected.name}</h2>
          <p className="text-gray-600 text-sm mt-1">Introduce tu PIN</p>
        </div>

        {/* Puntos del PIN */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > i
                  ? 'bg-[#1E2B28] border-[#1E2B28] scale-110'
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
                disabled={loading || pin.length >= 4}
                className="flex items-center justify-center h-16 rounded-2xl bg-white border border-gray-100 hover:border-[#1E2B28] hover:shadow-md active:scale-95 transition-all text-xl font-semibold text-black shadow-sm disabled:opacity-40"
              >
                {key}
              </button>
            )
          })}
        </div>

        {loading && (
          <p className="text-center text-sm text-gray-600 mt-6 animate-pulse">Entrando...</p>
        )}
      </div>
    </div>
  )
}
