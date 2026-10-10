'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PAGE_SIZES = [10, 25, 50] as const

type State = { key: string; page: number; size: number }

/**
 * Paginación en pantalla: de la lista que ya está cargada (con sus filtros y búsquedas aplicados) solo
 * se dibuja una página. `resetKey` identifica los filtros: cuando cambian, se vuelve a la página 1.
 */
export function usePaged<T>(items: T[], resetKey: string, initialSize = 10) {
  const [state, setState] = useState<State>({ key: resetKey, page: 1, size: initialSize })
  // Si han cambiado los filtros, la página buena es la 1 (sin efectos: se deriva al pintar)
  const page = state.key === resetKey ? state.page : 1
  const size = state.size
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / size))
  const safePage = Math.min(page, pages)
  const start = (safePage - 1) * size
  return {
    pageItems: items.slice(start, start + size),
    page: safePage,
    pages,
    size,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
    setPage: (p: number) => setState({ key: resetKey, page: Math.min(Math.max(1, p), pages), size }),
    setSize: (n: number) => setState({ key: resetKey, page: 1, size: n }),
  }
}

type PagerProps = {
  page: number
  pages: number
  size: number
  total: number
  from: number
  to: number
  setPage: (p: number) => void
  setSize: (n: number) => void
  /** Cómo se llama lo que se lista: «albaranes», «productos»… */
  noun?: string
  className?: string
}

/** Números de página con huecos: 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages, page - 1, page, page + 1])
  if (page <= 3) { set.add(2); set.add(3); set.add(4) }
  if (page >= pages - 2) { set.add(pages - 1); set.add(pages - 2); set.add(pages - 3) }
  const sorted = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => { if (i > 0 && n - sorted[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

export function Pager({ page, pages, size, total, from, to, setPage, setSize, noun = 'resultados', className }: PagerProps) {
  if (total <= PAGE_SIZES[0] && size === PAGE_SIZES[0]) return null // menos de una página: no hace falta
  const btn = 'min-w-[40px] h-10 px-2 rounded-lg text-sm font-semibold border transition-colors flex items-center justify-center'
  return (
    <nav aria-label="Paginación" className={cn('flex flex-wrap items-center justify-between gap-3 pt-2', className)}>
      <p className="text-sm text-gray-600">
        Mostrando <strong className="text-black">{from}–{to}</strong> de <strong className="text-black">{total.toLocaleString('es-ES')}</strong> {noun}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Página anterior"
          className={cn(btn, 'border-gray-200 bg-white text-gray-700 hover:border-[#1E2B28] disabled:opacity-40 disabled:hover:border-gray-200')}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageList(page, pages).map((n, i) => n === '…'
          ? <span key={`g${i}`} className="px-1 text-gray-400">…</span>
          : <button key={n} onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined}
              className={cn(btn, n === page ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'border-gray-200 bg-white text-gray-700 hover:border-[#1E2B28]')}>{n}</button>)}
        <button onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Página siguiente"
          className={cn(btn, 'border-gray-200 bg-white text-gray-700 hover:border-[#1E2B28] disabled:opacity-40 disabled:hover:border-gray-200')}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-2">
          <span className="hidden sm:inline">Por página</span>
          <select value={size} onChange={e => setSize(Number(e.target.value))} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm font-medium">
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </nav>
  )
}
