'use server'

import { revalidatePath } from 'next/cache'
import { adminDb, assertCostAccess, assertProduccion, rowsOf } from '@/lib/serverAccess'
import { madridDay } from '@/lib/dates'
import { median, PAUSE_STAGE, runMetrics, STAGE_PRESETS, type Participant, type RunLike, type Stage, type StageKind } from '@/lib/productionTime'

// ── Tipos de filas (las tablas nuevas no están en los tipos generados de Supabase) ──

type StageRow = { id: string; stage: string; kind: StageKind; started_at: string; ended_at: string | null }
type ParticipantRow = { worker_id: string; joined_at: string; left_at: string | null; production_workers?: { name: string } | null }
type RunRow = {
  id: string
  product_id: string
  station: string | null
  started_at: string
  ended_at: string | null
  units_produced: number | string | null
  units_wasted: number | string | null
  products: { name: string; unit: string } | null
  production_stage_logs: StageRow[] | null
  production_participants: ParticipantRow[] | null
}

const RUN_SELECT = 'id, product_id, station, started_at, ended_at, units_produced, units_wasted, products(name, unit), production_stage_logs(id, stage, kind, started_at, ended_at), production_participants(worker_id, joined_at, left_at, production_workers(name))'

const nowIso = () => new Date().toISOString()

function toRunLike(r: RunRow): RunLike & { stages: Stage[]; participants: Participant[] } {
  return {
    started_at: r.started_at,
    ended_at: r.ended_at,
    stages: [...(r.production_stage_logs ?? [])].sort((a, b) => a.started_at.localeCompare(b.started_at)),
    participants: (r.production_participants ?? []).map(p => ({ worker_id: p.worker_id, name: p.production_workers?.name ?? '', joined_at: p.joined_at, left_at: p.left_at })),
  }
}

// ── Estado de las tablets ───────────────────────────────────────────────────

export type RunView = {
  id: string
  product_id: string
  product_name: string
  unit: string
  station: string | null
  started_at: string
  stages: Stage[]
  participants: Participant[]
}

export type ProductionState = {
  serverNow: number
  workers: { id: string; name: string }[]
  runs: RunView[]
  products: { id: string; name: string; unit: string; category: string | null; runs: number }[]
  today: { id: string; product_name: string; unit: string; ended_at: string; units: number; minutes: number }[]
}

export async function getProductionState(): Promise<ProductionState | { error: string }> {
  const { orgId } = await assertProduccion()
  const db = adminDb()
  const [workers, running, products, counts, finished] = await Promise.all([
    db.from('production_workers').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    db.from('production_runs').select(RUN_SELECT).eq('organization_id', orgId).eq('status', 'en_curso').order('started_at'),
    db.from('products').select('id, name, unit, product_categories!products_category_id_fkey(name)').eq('is_active', true).is('deleted_at', null).order('name'),
    db.from('production_runs').select('product_id').eq('organization_id', orgId).neq('status', 'cancelada'),
    db.from('production_runs').select(RUN_SELECT).eq('organization_id', orgId).eq('status', 'terminada')
      .gte('ended_at', new Date(Date.now() - 36 * 3600000).toISOString()).order('ended_at', { ascending: false }).limit(60),
  ])
  if (workers.error || counts.error) return { error: 'Faltan las tablas de producción en la base de datos (migración 20261009).' }

  const perProduct: Record<string, number> = {}
  for (const c of rowsOf<{ product_id: string }>(counts)) perProduct[c.product_id] = (perProduct[c.product_id] ?? 0) + 1

  const today = madridDay(Date.now())
  return {
    serverNow: Date.now(),
    workers: rowsOf<{ id: string; name: string }>(workers),
    runs: rowsOf<RunRow>(running).map(r => ({
      id: r.id, product_id: r.product_id, product_name: r.products?.name ?? 'Producto', unit: r.products?.unit ?? 'unidad',
      station: r.station, started_at: r.started_at,
      stages: toRunLike(r).stages, participants: toRunLike(r).participants,
    })),
    products: rowsOf<{ id: string; name: string; unit: string; product_categories: { name: string } | null }>(products).map(p => ({
      id: p.id, name: p.name, unit: p.unit, category: p.product_categories?.name ?? null, runs: perProduct[p.id] ?? 0,
    })),
    // «Terminadas hoy» según el día de España, no el del servidor (UTC)
    today: rowsOf<RunRow>(finished).filter(r => r.ended_at && madridDay(r.ended_at) === today).map(r => ({
      id: r.id, product_name: r.products?.name ?? 'Producto', unit: r.products?.unit ?? 'unidad', ended_at: r.ended_at as string,
      units: Number(r.units_produced), minutes: (new Date(r.ended_at as string).getTime() - new Date(r.started_at).getTime()) / 60000,
    })),
  }
}

// ── Trabajadores ────────────────────────────────────────────────────────────

export async function addProductionWorker(name: string) {
  const { orgId } = await assertProduccion()
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error('Escribe un nombre')
  const { error } = await adminDb().from('production_workers').insert({ organization_id: orgId, name: clean })
  if (error) throw new Error('No se pudo añadir')
  revalidatePath('/produccion')
}

export async function removeProductionWorker(id: string) {
  const { orgId } = await assertProduccion()
  await adminDb().from('production_workers').update({ active: false }).eq('id', id).eq('organization_id', orgId)
  revalidatePath('/produccion')
}

// ── Tandas en curso ─────────────────────────────────────────────────────────

async function assertOwnRunning(runId: string, orgId: string) {
  const { data } = await adminDb().from('production_runs').select('id, status').eq('id', runId).eq('organization_id', orgId).maybeSingle()
  if (!data || data.status !== 'en_curso') throw new Error('Esa producción ya no está en curso')
}

/** Cierra lo que siga abierto de una tanda (etapa y personas) a la misma hora. */
async function closeOpen(runId: string, at: string) {
  const db = adminDb()
  await db.from('production_stage_logs').update({ ended_at: at }).eq('run_id', runId).is('ended_at', null)
  await db.from('production_participants').update({ left_at: at }).eq('run_id', runId).is('left_at', null)
}

export async function startRun(productId: string, workerId: string, station: string | null) {
  const { orgId } = await assertProduccion()
  const db = adminDb()
  const now = nowIso()
  const { data: run, error } = await db.from('production_runs')
    .insert({ organization_id: orgId, product_id: productId, station: station || null, started_at: now })
    .select('id').single()
  if (error || !run) throw new Error('No se pudo empezar la producción')
  await db.from('production_stage_logs').insert({ run_id: run.id, stage: 'Preparación', kind: 'personal', started_at: now })
  await db.from('production_participants').insert({ run_id: run.id, worker_id: workerId, joined_at: now })
  return run.id as string
}

export async function switchStage(runId: string, stage: string) {
  const { orgId } = await assertProduccion()
  await assertOwnRunning(runId, orgId)
  // Solo las etapas conocidas: el tipo (personal / espera / pausa) sale de aquí, no del navegador.
  const preset = STAGE_PRESETS.find(p => p.stage === stage)
  if (!preset && stage !== PAUSE_STAGE) throw new Error('Etapa no válida')
  const kind: StageKind = stage === PAUSE_STAGE ? 'pausa' : (preset as NonNullable<typeof preset>).kind

  const db = adminDb()
  const { data: open } = await db.from('production_stage_logs').select('id, stage').eq('run_id', runId).is('ended_at', null)
  if ((open ?? []).some((s: { stage: string }) => s.stage === stage)) return // ya está en esa etapa
  const now = nowIso()
  await db.from('production_stage_logs').update({ ended_at: now }).eq('run_id', runId).is('ended_at', null)
  await db.from('production_stage_logs').insert({ run_id: runId, stage, kind, started_at: now })
}

export async function joinRun(runId: string, workerId: string) {
  const { orgId } = await assertProduccion()
  await assertOwnRunning(runId, orgId)
  const db = adminDb()
  const { data: open } = await db.from('production_participants').select('id').eq('run_id', runId).eq('worker_id', workerId).is('left_at', null)
  if ((open ?? []).length > 0) return
  await db.from('production_participants').insert({ run_id: runId, worker_id: workerId, joined_at: nowIso() })
}

export async function leaveRun(runId: string, workerId: string) {
  const { orgId } = await assertProduccion()
  await assertOwnRunning(runId, orgId)
  await adminDb().from('production_participants').update({ left_at: nowIso() }).eq('run_id', runId).eq('worker_id', workerId).is('left_at', null)
}

export async function finishRun(runId: string, unitsProduced: number, unitsWasted: number) {
  const { orgId } = await assertProduccion()
  await assertOwnRunning(runId, orgId)
  const units = Number(unitsProduced)
  if (!(units > 0)) throw new Error('Indica cuántas unidades han salido')
  const now = nowIso()
  await closeOpen(runId, now)
  await adminDb().from('production_runs').update({
    status: 'terminada', ended_at: now, units_produced: units, units_wasted: Math.max(0, Number(unitsWasted) || 0),
  }).eq('id', runId)
  revalidatePath('/costes')
}

export async function cancelRun(runId: string) {
  const { orgId } = await assertProduccion()
  await assertOwnRunning(runId, orgId)
  const now = nowIso()
  await closeOpen(runId, now)
  await adminDb().from('production_runs').update({ status: 'cancelada', ended_at: now }).eq('id', runId)
}

// ── Historial y tiempos medidos para Costes (requieren el código de acceso) ─────

export type RunHistoryItem = {
  id: string
  product_name: string
  unit: string
  station: string | null
  started_at: string
  ended_at: string
  units: number
  wasted: number
  elapsed: number
  attended: number
  waiting: number
  paused: number
  personMinutes: number
  stages: { stage: string; kind: StageKind; minutes: number }[]
  people: { name: string; minutes: number }[]
}

export async function getRunHistory(): Promise<RunHistoryItem[]> {
  const { orgId } = await assertCostAccess()
  const res = await adminDb().from('production_runs').select(RUN_SELECT)
    .eq('organization_id', orgId).eq('status', 'terminada').order('ended_at', { ascending: false }).limit(150)
  return rowsOf<RunRow>(res).map(r => {
    const m = runMetrics(toRunLike(r), Date.now())
    return {
      id: r.id, product_name: r.products?.name ?? 'Producto', unit: r.products?.unit ?? 'unidad', station: r.station,
      started_at: r.started_at, ended_at: r.ended_at as string, units: Number(r.units_produced), wasted: Number(r.units_wasted) || 0,
      elapsed: m.elapsed, attended: m.attended, waiting: m.waiting, paused: m.paused, personMinutes: m.personMinutes,
      stages: Object.entries(m.byStage).map(([stage, v]) => ({ stage, kind: v.kind, minutes: v.minutes })),
      people: Object.entries(m.perPerson).map(([name, minutes]) => ({ name, minutes })).sort((x, y) => y.minutes - x.minutes),
    }
  })
}

// Borrar una tanda terminada (por ejemplo, una prueba o un error).
export async function deleteRun(runId: string) {
  const { orgId } = await assertCostAccess()
  await adminDb().from('production_runs').delete().eq('id', runId).eq('organization_id', orgId)
  revalidatePath('/costes')
}

export type MeasuredProduct = {
  product_id: string
  name: string
  unit: string
  runs: number
  unitsPerRun: number          // mediana
  personMinutes: number        // mediana de minutos-persona por tanda
  avgPeople: number
  attendedMinutes: number      // mediana de tiempo con personal (reloj)
  waitingMinutes: number       // mediana de esperas (horno, enfriado…)
  leadMinutes: number          // mediana de inicio a fin, sin pausas
  stages: { stage: string; kind: StageKind; minutes: number }[]
  suggested: { people: number; minutes: number; yield_qty: number }
}

const LAST_RUNS_PER_PRODUCT = 10

export async function getMeasuredProducts(): Promise<MeasuredProduct[]> {
  const { orgId } = await assertCostAccess()
  const res = await adminDb().from('production_runs').select(RUN_SELECT)
    .eq('organization_id', orgId).eq('status', 'terminada').order('ended_at', { ascending: false }).limit(1000)
  const byProduct = new Map<string, RunRow[]>()
  for (const r of rowsOf<RunRow>(res)) {
    const list = byProduct.get(r.product_id) ?? []
    if (list.length < LAST_RUNS_PER_PRODUCT) list.push(r)
    byProduct.set(r.product_id, list)
  }

  const out: MeasuredProduct[] = []
  for (const [productId, runs] of byProduct) {
    const ms = runs.map(r => ({ units: Number(r.units_produced), m: runMetrics(toRunLike(r), Date.now()) }))
    const personMin = median(ms.map(x => x.m.personMinutes))
    const attended = median(ms.map(x => x.m.attended))
    const people = attended > 0 ? Math.max(1, personMin / attended) : 1
    const roundedPeople = Math.max(1, Math.round(people))

    const stageNames = new Set(ms.flatMap(x => Object.keys(x.m.byStage)))
    const stages = [...stageNames].map(stage => ({
      stage,
      kind: (ms.find(x => x.m.byStage[stage])?.m.byStage[stage].kind ?? 'personal') as StageKind,
      minutes: median(ms.map(x => x.m.byStage[stage]?.minutes ?? 0)),
    }))
    const unitsPerRun = median(ms.map(x => x.units))
    out.push({
      product_id: productId,
      name: runs[0].products?.name ?? 'Producto',
      unit: runs[0].products?.unit ?? 'unidad',
      runs: runs.length,
      unitsPerRun,
      personMinutes: personMin,
      avgPeople: people,
      attendedMinutes: attended,
      waitingMinutes: median(ms.map(x => x.m.waiting)),
      leadMinutes: median(ms.map(x => x.m.elapsed - x.m.paused)),
      stages,
      suggested: {
        people: roundedPeople,
        minutes: Math.round((personMin / roundedPeople) * 10) / 10,
        yield_qty: Math.round(unitsPerRun * 100) / 100,
      },
    })
  }
  return out.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name, 'es'))
}

type SheetCosts = {
  id: string
  yield_qty: number | string
  ingredients: { kind?: string; per?: string; unit_price?: number | string; quantity?: number | string }[] | null
  extras: { per?: string; amount?: number | string }[] | null
}

// Pasa los tiempos medidos a la ficha de coste de ese producto (personas, minutos por
// persona y unidades por tanda). Si no tiene ficha, la crea.
export async function applyMeasuredToSheet(productId: string): Promise<{ created: boolean }> {
  const { orgId } = await assertCostAccess()
  const measured = (await getMeasuredProducts()).find(m => m.product_id === productId)
  if (!measured) throw new Error('No hay tandas terminadas de ese producto')

  const db = adminDb()
  const patch = { people: measured.suggested.people, minutes: measured.suggested.minutes, yield_qty: measured.suggested.yield_qty || 1, updated_at: nowIso() }
  const { data } = await db.from('product_cost_sheets').select('id, yield_qty, ingredients, extras').eq('product_id', productId).eq('organization_id', orgId).maybeSingle()
  const sheet = data as SheetCosts | null

  if (sheet) {
    // Si cambia el tamaño de la tanda, los costes de la tanda se reescalan para que el
    // coste por unidad no cambie: solo se sustituyen los tiempos por los medidos.
    const oldYield = Number(sheet.yield_qty) || 0
    const ratio = oldYield > 0 ? patch.yield_qty / oldYield : 1
    const scaled: Record<string, unknown> = {}
    if (ratio !== 1) {
      scaled.ingredients = (sheet.ingredients ?? []).map(i => i.kind === 'direct'
        ? (i.per === 'unit' ? i : { ...i, unit_price: Number(i.unit_price) * ratio })
        : { ...i, quantity: Number(i.quantity) * ratio })
      scaled.extras = (sheet.extras ?? []).map(e => (e.per === 'batch' ? { ...e, amount: Number(e.amount) * ratio } : e))
    }
    await db.from('product_cost_sheets').update({ ...patch, ...scaled }).eq('id', sheet.id)
    revalidatePath('/costes')
    return { created: false }
  }

  const { data: prod } = await db.from('products').select('name, unit, cost_price, margin').eq('id', productId).single()
  const cost = Number(prod?.cost_price) || 0
  await db.from('product_cost_sheets').insert({
    organization_id: orgId, product_id: productId, name: prod?.name ?? measured.name, ...patch,
    ingredients: cost > 0 ? [{ name: 'Materia prima', quantity: 1, unit: prod?.unit ?? 'unidad', unit_price: cost * patch.yield_qty, waste_pct: 0, kind: 'direct', per: 'batch' }] : [],
    extras: [], markup_pct: Math.round(Number(prod?.margin || 0) * 1000) / 10,
  })
  revalidatePath('/costes')
  return { created: true }
}
