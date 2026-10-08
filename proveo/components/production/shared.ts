export type Station = 'caliente' | 'frio' | 'todas'

export const WORKER_KEY = 'proveo:prod:worker'
export const STATION_KEY = 'proveo:prod:station'

export const KIND_LABEL = { personal: 'Con personal', espera: 'Esperando (sin personal)', pausa: 'En pausa' } as const
export const KIND_STYLE = {
  personal: 'bg-green-100 text-green-900 border-green-300',
  espera: 'bg-amber-100 text-amber-900 border-amber-300',
  pausa: 'bg-gray-200 text-gray-800 border-gray-300',
} as const

export const readLS = (k: string): string | null => {
  try { return window.localStorage.getItem(k) } catch { return null }
}
export const writeLS = (k: string, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(k)
    else window.localStorage.setItem(k, v)
  } catch { /* ignorar */ }
}
