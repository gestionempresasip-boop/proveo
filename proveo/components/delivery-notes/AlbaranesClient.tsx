'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Trash2, Undo2, Search, X, ChevronRight, Printer } from 'lucide-react'
import { deleteDeliveryNote } from '@/app/actions/orders'
import { cn } from '@/lib/utils'

type Note = {
  id: string
  note_number: number
  delivered_at: string
  type?: 'entrega' | 'devolucion'
  delivery_note_items?: { delivered_quantity: number; unit_price: number; return_reason: string | null }[]
  orders: {
    order_number: number
    total_price: number
    restaurant_id: string
    organizations: { name: string } | null
  } | null
}

type TypeFilter = 'todos' | 'entrega' | 'devolucion'

function noteAmount(note: Note): number {
  if (note.type === 'devolucion') {
    return -(note.delivery_note_items ?? []).reduce((s, i) => s + Number(i.delivered_quantity) * Number(i.unit_price), 0)
  }
  return Number(note.orders?.total_price ?? 0)
}

function eur(n: number) {
  return `${n < 0 ? '− ' : ''}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function NoteRow({ note, isNave, onDeleted }: { note: Note; isNave: boolean; onDeleted: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const isReturn = note.type === 'devolucion'

  function handleDelete() {
    setLoading(true)
    onDeleted(note.id)
    deleteDeliveryNote(note.id)
  }

  if (confirm) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-red-50">
        <p className="text-sm text-red-700 font-medium">¿Eliminar el albarán #{note.note_number}?</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '…' : 'Sí, eliminar'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            No
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center hover:bg-gray-50/70 transition-colors">
      <Link href={`/albaranes/${note.id}`} className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-3.5">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          isReturn ? 'bg-amber-50' : 'bg-[#1E2B28]/[0.06]'
        )}>
          {isReturn ? <Undo2 className="w-5 h-5 text-amber-600" /> : <FileText className="w-5 h-5 text-[#1E2B28]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-black text-sm flex items-center gap-2 flex-wrap">
            Albarán #{note.note_number}
            {isReturn && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                Devolución
              </span>
            )}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 truncate">
            Pedido #{note.orders?.order_number}
            {isNave && note.orders?.organizations?.name ? ` · ${note.orders.organizations.name}` : ''}
            {' · '}
            {new Date(note.delivered_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        {isNave && (
          <p className={cn('font-bold text-sm shrink-0', isReturn ? 'text-amber-700' : 'text-[#1E2B28]')}>
            {eur(noteAmount(note))}
          </p>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </Link>
      <button
        onClick={() => setConfirm(true)}
        className="p-3 mr-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
        title="Eliminar albarán"
        aria-label={`Eliminar albarán ${note.note_number}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

const dayStr = (d: Date) => d.toLocaleDateString('sv-SE')
const madridDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

function PrintRange({ notes, restaurants, isNave }: { notes: Note[]; restaurants: string[]; isNave: boolean }) {
  const [open, setOpen] = useState(false)
  const today = dayStr(new Date())
  const [desde, setDesde] = useState(today)
  const [hasta, setHasta] = useState(today)
  const [rest, setRest] = useState('todos')
  const [tipo, setTipo] = useState<TypeFilter>('todos')
  const [resumen, setResumen] = useState(true)

  function preset(kind: 'hoy' | 'semana' | 'mes' | 'mespasado') {
    const now = new Date()
    if (kind === 'hoy') { setDesde(dayStr(now)); setHasta(dayStr(now)) }
    if (kind === 'semana') {
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      setDesde(dayStr(monday)); setHasta(dayStr(now))
    }
    if (kind === 'mes') { setDesde(dayStr(new Date(now.getFullYear(), now.getMonth(), 1))); setHasta(dayStr(now)) }
    if (kind === 'mespasado') {
      setDesde(dayStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
      setHasta(dayStr(new Date(now.getFullYear(), now.getMonth(), 0)))
    }
  }

  const valid = desde !== '' && hasta !== '' && desde <= hasta
  const count = useMemo(() => {
    if (!valid) return 0
    return notes.filter(n => {
      const d = madridDay(n.delivered_at)
      if (d < desde || d > hasta) return false
      const isReturn = n.type === 'devolucion'
      if (tipo === 'entrega' && isReturn) return false
      if (tipo === 'devolucion' && !isReturn) return false
      if (isNave && rest !== 'todos' && n.orders?.organizations?.name !== rest) return false
      return true
    }).length
  }, [notes, desde, hasta, tipo, rest, valid, isNave])

  const params = new URLSearchParams({ desde, hasta })
  if (isNave && rest !== 'todos') params.set('restaurante', rest)
  if (tipo !== 'todos') params.set('tipo', tipo)
  if (!resumen) params.set('resumen', '0')

  const chip = (active: boolean) => cn(
    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
    active ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
  )
  const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]'

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-3 hover:bg-[#141F1C] transition-colors"
      >
        <Printer className="w-4 h-4" /> Imprimir por fechas
      </button>

      {open && (
        <div className="mt-3 bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => preset('hoy')} className={chip(false)}>Hoy</button>
            <button onClick={() => preset('semana')} className={chip(false)}>Esta semana</button>
            <button onClick={() => preset('mes')} className={chip(false)}>Este mes</button>
            <button onClick={() => preset('mespasado')} className={chip(false)}>Mes pasado</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Desde</span>
              <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className={cn(field, 'mt-1')} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Hasta</span>
              <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className={cn(field, 'mt-1')} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isNave && restaurants.length > 1 && (
              <label className="block">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Restaurante</span>
                <select value={rest} onChange={e => setRest(e.target.value)} className={cn(field, 'mt-1')}>
                  <option value="todos">Todos los restaurantes</option>
                  {restaurants.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tipo</span>
              <select value={tipo} onChange={e => setTipo(e.target.value as TypeFilter)} className={cn(field, 'mt-1')}>
                <option value="todos">Entregas y devoluciones</option>
                <option value="entrega">Solo entregas</option>
                <option value="devolucion">Solo devoluciones</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={resumen} onChange={e => setResumen(e.target.checked)} className="w-4 h-4 accent-[#1E2B28]" />
            Añadir una hoja resumen con el total al principio
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-sm text-gray-700">
              {!valid ? 'Elige un rango de fechas válido.' : count > 0 ? <><strong>{count}</strong> {count !== 1 ? 'albaranes' : 'albarán'} en ese rango</> : 'No hay albaranes cargados en ese rango.'}
            </p>
            {valid ? (
              <Link
                href={`/albaranes/imprimir?${params.toString()}`}
                className="flex items-center gap-2 rounded-xl bg-[#A8793A] text-white text-sm font-semibold px-5 py-3 hover:bg-[#8F6630] transition-colors"
              >
                <Printer className="w-4 h-4" /> Ver e imprimir
              </Link>
            ) : (
              <span className="rounded-xl bg-gray-200 text-gray-500 text-sm font-semibold px-5 py-3">Ver e imprimir</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AlbaranesClient({ notes: initialNotes, isNave }: { notes: Note[]; isNave: boolean }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos')
  const [restaurant, setRestaurant] = useState('todos')

  function handleDeleted(id: string) { setNotes(prev => prev.filter(n => n.id !== id)) }

  const restaurants = useMemo(() => {
    const names = new Set<string>()
    for (const n of notes) if (n.orders?.organizations?.name) names.add(n.orders.organizations.name)
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [notes])

  const hasReturns = useMemo(() => notes.some(n => n.type === 'devolucion'), [notes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes.filter(n => {
      const isReturn = n.type === 'devolucion'
      if (typeFilter === 'entrega' && isReturn) return false
      if (typeFilter === 'devolucion' && !isReturn) return false
      if (restaurant !== 'todos' && n.orders?.organizations?.name !== restaurant) return false
      if (q) {
        const hay = `${n.note_number} ${n.orders?.order_number ?? ''} ${n.orders?.organizations?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q.replace('#', ''))) return false
      }
      return true
    })
  }, [notes, search, typeFilter, restaurant])

  const months = useMemo(() => {
    const map = new Map<string, { label: string; notes: Note[] }>()
    for (const n of filtered) {
      const d = new Date(n.delivered_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, { label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }), notes: [] })
      map.get(key)!.notes.push(n)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (notes.length === 0) {
    return (
      <div className="text-center py-20 text-gray-600">
        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium">No hay albaranes todavía</p>
      </div>
    )
  }

  const chip = (active: boolean) => cn(
    'shrink-0 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap',
    active ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
  )
  const hasFilters = search !== '' || typeFilter !== 'todos' || restaurant !== 'todos'

  return (
    <div className="space-y-4">
      <PrintRange notes={notes} restaurants={restaurants} isNave={isNave} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isNave ? 'Buscar por nº de albarán, pedido o restaurante…' : 'Buscar por nº de albarán o de pedido…'}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] focus:border-transparent placeholder-gray-600"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" aria-label="Borrar búsqueda">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(isNave && restaurants.length > 1) || hasReturns ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => { setTypeFilter('todos'); setRestaurant('todos') }} className={chip(!hasFilters || (typeFilter === 'todos' && restaurant === 'todos'))}>
            Todos
          </button>
          {hasReturns && (
            <>
              <button onClick={() => setTypeFilter(typeFilter === 'entrega' ? 'todos' : 'entrega')} className={chip(typeFilter === 'entrega')}>
                Entregas
              </button>
              <button onClick={() => setTypeFilter(typeFilter === 'devolucion' ? 'todos' : 'devolucion')} className={chip(typeFilter === 'devolucion')}>
                Devoluciones
              </button>
            </>
          )}
          {isNave && restaurants.length > 1 && restaurants.map(name => (
            <button key={name} onClick={() => setRestaurant(restaurant === name ? 'todos' : name)} className={chip(restaurant === name)}>
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {months.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin resultados</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter('todos'); setRestaurant('todos') }}
            className="mt-3 text-sm text-[#1E2B28] underline font-medium"
          >
            Quitar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {months.map(([key, m]) => (
            <section key={key}>
              <div className="flex items-baseline justify-between px-1 pb-2">
                <h2 className="font-bold text-black capitalize">{m.label}</h2>
                <p className="text-xs text-gray-600">
                  {m.notes.length} {m.notes.length !== 1 ? 'albaranes' : 'albarán'}
                  {isNave && ` · ${eur(m.notes.reduce((s, n) => s + noteAmount(n), 0))}`}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {m.notes.map(note => (
                  <NoteRow key={note.id} note={note} isNave={isNave} onDeleted={handleDeleted} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
