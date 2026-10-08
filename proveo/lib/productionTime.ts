// Cálculo de tiempos de una tanda de producción. Funciones puras: se usan igual
// en la pantalla de las tablets (cronómetro en vivo) y en el servidor (medias
// por producto para las fichas de Costes).

export type StageKind = 'personal' | 'espera' | 'pausa'

export type Stage = { id: string; stage: string; kind: StageKind; started_at: string; ended_at: string | null }
export type Participant = { worker_id: string; name: string; joined_at: string; left_at: string | null }

export type RunLike = {
  started_at: string
  ended_at?: string | null
  stages: Stage[]
  participants: Participant[]
}

const MIN = 60000
const t = (iso: string | null | undefined, fallback: number) => (iso ? new Date(iso).getTime() : fallback)

// Tiempos en minutos. `now` solo se usa para lo que sigue abierto (en curso).
export function runMetrics(run: RunLike, now: number) {
  const start = new Date(run.started_at).getTime()
  const end = t(run.ended_at, now)
  const elapsed = Math.max(0, (end - start) / MIN)

  const byStage: Record<string, { kind: StageKind; minutes: number }> = {}
  let attended = 0, waiting = 0, paused = 0, personMinutes = 0
  const perPerson: Record<string, number> = {} // minutos trabajados por cada persona
  for (const s of run.stages) {
    const a = new Date(s.started_at).getTime()
    const b = t(s.ended_at, end)
    const dur = Math.max(0, (b - a) / MIN)
    ;(byStage[s.stage] ??= { kind: s.kind, minutes: 0 }).minutes += dur
    if (s.kind === 'espera') waiting += dur
    else if (s.kind === 'pausa') paused += dur
    else {
      attended += dur
      // minutos-persona: solape de este tramo con cada persona presente
      for (const p of run.participants) {
        const pa = new Date(p.joined_at).getTime()
        const pb = t(p.left_at, end)
        const overlap = Math.min(b, pb) - Math.max(a, pa)
        if (overlap > 0) {
          personMinutes += overlap / MIN
          perPerson[p.name] = (perPerson[p.name] ?? 0) + overlap / MIN
        }
      }
    }
  }
  return { elapsed, attended, waiting, paused, personMinutes, byStage, perPerson }
}

export function fmtDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '0 min'
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Etapas disponibles. Las de «espera» no cuentan como trabajo de nadie
// (horno, enfriado, reposo), pero sí para saber cuánto tarda en estar listo.
export const STAGE_PRESETS: { stage: string; kind: StageKind; stations: ('caliente' | 'frio')[]; hint: string }[] = [
  { stage: 'Preparación',          kind: 'personal', stations: ['caliente', 'frio'], hint: 'Cortar, pesar, mezclar' },
  { stage: 'Cocción atendida',     kind: 'personal', stations: ['caliente'],         hint: 'Cocinando y vigilando' },
  { stage: 'Cocción sin personal', kind: 'espera',   stations: ['caliente'],         hint: 'Horno o fuego solo' },
  { stage: 'Terminación',          kind: 'personal', stations: ['caliente', 'frio'], hint: 'Rebozar, montar, emplatar' },
  { stage: 'Enfriado / abatido',   kind: 'espera',   stations: ['frio'],             hint: 'Enfriando, nadie trabaja' },
  { stage: 'Envasado',             kind: 'personal', stations: ['frio'],             hint: 'Bolsas, bandejas, vacío' },
  { stage: 'Etiquetado',           kind: 'personal', stations: ['frio'],             hint: 'Etiquetas y lotes' },
  { stage: 'Limpieza',             kind: 'personal', stations: ['caliente', 'frio'], hint: 'Recoger y limpiar' },
  { stage: 'Reposo / espera',      kind: 'espera',   stations: ['caliente', 'frio'], hint: 'Reposar, fermentar, esperar' },
]
export const PAUSE_STAGE = 'Pausa'
