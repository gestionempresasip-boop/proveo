'use server'

import { revalidatePath } from 'next/cache'
import { adminDb, assertCostAccess, rowsOf } from '@/lib/serverAccess'
import { loadCostContext } from '@/lib/costContext'
import { computeSheet, DEFAULT_SETTINGS, type CostSettings, type CostSheet } from '@/lib/realCost'

// Los costes reales incluyen sueldos y estructura de la nave: solo nave/admin y, además,
// con el código de acceso ya introducido (el mismo de las categorías protegidas de Productos).

type SavedSheet = CostSheet & { id: string }
type ProductRow = { id: string; name: string; unit: string | null; cost_price: number | string; margin: number | string | null }

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0 }
const clamp = (v: unknown, min: number, max: number) => Math.min(Math.max(n(v), min), max)

function cleanSheet(input: CostSheet): CostSheet {
  const name = clean(input.name, 120)
  if (!name) throw new Error('Falta el nombre del producto')
  return {
    product_id: input.product_id || null,
    name,
    yield_qty: n(input.yield_qty) || 1,
    people: n(input.people) || 1,
    minutes: n(input.minutes),
    markup_pct: clamp(input.markup_pct, 0, 2000),
    notes: clean(input.notes, 1000) || null,
    external: input.external ? {
      markup_pct: clamp(input.external.markup_pct, 0, 1000),
      dist_margin_pct: clamp(input.external.dist_margin_pct, 0, 90),
      pvp: n(input.external.pvp),
    } : null,
    ingredients: (input.ingredients ?? []).slice(0, 80).map(i => ({
      name: clean(i.name, 120), product_id: i.product_id || null, quantity: n(i.quantity),
      unit: clean(i.unit, 20), unit_price: n(i.unit_price), waste_pct: clamp(i.waste_pct, 0, 95),
      ...(i.kind === 'direct' ? { kind: 'direct' as const, per: i.per === 'unit' ? 'unit' as const : 'batch' as const } : {}),
    })).filter(i => i.name),
    extras: (input.extras ?? []).slice(0, 40).map(e => ({
      name: clean(e.name, 120), amount: n(e.amount), per: e.per === 'batch' ? 'batch' as const : 'unit' as const,
    })).filter(e => e.name),
  }
}

export async function saveCostSettings(input: CostSettings): Promise<CostSettings> {
  const { orgId } = await assertCostAccess()
  const row = {
    organization_id: orgId,
    labor_item_ids: (input.labor_item_ids ?? []).filter(id => typeof id === 'string').slice(0, 100),
    hours_per_person: clamp(input.hours_per_person, 1, 744),
    efficiency_pct: clamp(input.efficiency_pct, 1, 100),
    indirect_pct: clamp(input.indirect_pct, 0, 100),
    updated_at: new Date().toISOString(),
  }
  const { error } = await adminDb().from('nave_cost_settings').upsert(row, { onConflict: 'organization_id' })
  if (error) throw new Error('No se pudieron guardar los ajustes')
  revalidatePath('/costes')
  return { ...DEFAULT_SETTINGS, ...row }
}

export async function saveCostSheet(input: CostSheet): Promise<SavedSheet> {
  const { orgId } = await assertCostAccess()
  const row = { ...cleanSheet(input), organization_id: orgId, updated_at: new Date().toISOString() }
  const db = adminDb()
  const q = input.id
    ? db.from('product_cost_sheets').update(row).eq('id', input.id).eq('organization_id', orgId)
    : db.from('product_cost_sheets').insert(row)
  const { data, error } = await q.select('*').single()
  if (error) {
    if (error.message.includes('uq_product_cost_sheets_product')) throw new Error('Ese producto ya tiene una ficha de coste')
    throw new Error('No se pudo guardar la ficha')
  }
  revalidatePath('/costes')
  return data as SavedSheet
}

export async function deleteCostSheet(id: string) {
  const { orgId } = await assertCostAccess()
  await adminDb().from('product_cost_sheets').delete().eq('id', id).eq('organization_id', orgId)
  revalidatePath('/costes')
}

// Crea una ficha por cada producto activo que ya tiene coste en Productos y aún no tiene
// ficha: la materia prima es ese coste (por unidad del producto) y el margen objetivo es
// el que tiene puesto hoy. No modifica ningún producto.
export async function importSheetsFromProducts(): Promise<{ created: number; sheets: SavedSheet[] }> {
  const { orgId } = await assertCostAccess()
  const db = adminDb()
  const [products, existing] = await Promise.all([
    db.from('products').select('id, name, unit, cost_price, margin').eq('is_active', true).is('deleted_at', null).gt('cost_price', 0).order('name'),
    db.from('product_cost_sheets').select('product_id').eq('organization_id', orgId).not('product_id', 'is', null),
  ])
  const taken = new Set(rowsOf<{ product_id: string }>(existing).map(s => s.product_id))
  const rows = rowsOf<ProductRow>(products).filter(p => !taken.has(p.id)).map(p => ({
    organization_id: orgId,
    product_id: p.id,
    name: p.name.slice(0, 120),
    yield_qty: 1,
    people: 1,
    minutes: 0,
    ingredients: [{ name: 'Materia prima', quantity: 1, unit: p.unit ?? 'unidad', unit_price: Number(p.cost_price), waste_pct: 0, kind: 'direct', per: 'unit' }],
    extras: [],
    markup_pct: Math.min(Math.round(Number(p.margin || 0) * 1000) / 10, 2000),
  }))
  const created: SavedSheet[] = []
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await db.from('product_cost_sheets').insert(rows.slice(i, i + 100)).select('*')
    if (error) throw new Error('No se pudieron crear todas las fichas')
    created.push(...((data ?? []) as SavedSheet[]))
  }
  revalidatePath('/costes')
  return { created: created.length, sheets: created }
}

// Aplica el coste real de la ficha al producto del catálogo. Se recalcula aquí, en el
// servidor, con los datos guardados: nunca se fía de cifras del navegador. Cambia
// cost_price, margin y price (el precio que ven los restaurantes).
export async function applySheetToProduct(sheetId: string): Promise<{ cost: number; price: number }> {
  const { orgId } = await assertCostAccess()
  const db = adminDb()

  const { data } = await db.from('product_cost_sheets').select('*').eq('id', sheetId).eq('organization_id', orgId).single()
  const sheet = data as SavedSheet | null
  if (!sheet?.product_id) throw new Error('La ficha no está vinculada a ningún producto')

  const { rates, settings } = await loadCostContext(db, orgId)
  const result = computeSheet(sheet, rates, settings.indirect_pct)
  if (!(result.unitCost > 0)) throw new Error('El coste calculado es 0: revisa la ficha')

  const cost = Math.round(result.unitCost * 10000) / 10000
  const margin = Number(sheet.markup_pct) / 100
  const price = Math.round(cost * (1 + margin) * 10000) / 10000
  const { error } = await db.from('products').update({ cost_price: cost, margin, price, pending_review: false }).eq('id', sheet.product_id)
  if (error) throw new Error('No se pudo actualizar el producto')
  revalidatePath('/costes')
  revalidatePath('/admin/productos')
  revalidatePath('/catalogo')
  return { cost, price }
}
