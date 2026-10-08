// Coste real de producción de la nave, en un solo sitio para que la pantalla
// y el servidor (al aplicar el coste a un producto) den exactamente lo mismo.
// Son funciones puras: reciben datos y devuelven números.
//
// Método (absorción por hora de trabajo):
//   1. Se separan los costes mensuales de la nave en MANO DE OBRA DE PRODUCCIÓN
//      (los sueldos marcados como personal de producción + su parte de seguros
//      sociales) y ESTRUCTURA (todo lo demás: alquiler, hipoteca, luz, agua,
//      furgoneta, administrativa, limpieza, repartidor, servicios exteriores...).
//   2. Horas productivas al mes = personas de producción × horas por persona ×
//      rendimiento (nadie produce el 100% de las horas que cobra).
//   3. Tarifa de mano de obra (€/h) y tarifa de estructura (€/h) = coste mensual
//      / horas productivas.
//   4. Cada ficha de producto paga: ingredientes (con merma) + (personas × tiempo)
//      × (tarifa de mano de obra + tarifa de estructura) + extras (bolsa, transporte,
//      almacenamiento...) + un % de costes indirectos. Todo / unidades que salen.

export type NaveCostItem = { id: string; category: string; name: string; monthly_amount: number; active: boolean }

export type CostSettings = {
  labor_item_ids: string[]
  hours_per_person: number
  efficiency_pct: number
  indirect_pct: number
}

export type Ingredient = {
  name: string
  product_id?: string | null
  quantity: number
  unit: string
  unit_price: number   // € por unidad de compra (sin IVA)
  waste_pct: number    // merma al limpiar / cocinar
  // Modo "coste directo de materia prima": una sola línea con el coste total, sin
  // desglosar ingredientes. unit_price es entonces el importe y per dice a qué se refiere.
  kind?: 'direct'
  per?: 'unit' | 'batch'
}

export type Extra = { name: string; amount: number; per: 'unit' | 'batch' }

// Venta a distribuidores externos (fuera del grupo).
export type ExternalPricing = { markup_pct: number; dist_margin_pct: number; pvp: number }
export const DEFAULT_EXTERNAL: ExternalPricing = { markup_pct: 35, dist_margin_pct: 30, pvp: 0 }

export type CostSheet = {
  id?: string
  product_id: string | null
  name: string
  yield_qty: number
  people: number
  minutes: number
  ingredients: Ingredient[]
  extras: Extra[]
  markup_pct: number
  notes?: string | null
  external?: ExternalPricing | null
}

export const DEFAULT_SETTINGS: CostSettings = { labor_item_ids: [], hours_per_person: 160, efficiency_pct: 80, indirect_pct: 0 }

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// "Seguros sociales" cubre a toda la plantilla: se reparte entre producción y
// estructura según lo que cobra cada grupo.
export const isPayrollTax = (i: { name: string }) => /seguros? sociales|seguridad social|cargas sociales/i.test(i.name)

// Pista para marcar automáticamente quién es de producción la primera vez.
export const looksLikeProduction = (i: { category: string; name: string }) =>
  i.category === 'personal' && /cocin|pastel|ayudante|obrador|produc/i.test(i.name) && !/administrativ|limpieza|repartidor/i.test(i.name)

export type Rates = {
  producers: number
  productiveHours: number
  laborMonthly: number
  payrollTaxShare: number
  structureMonthly: number
  laborRate: number       // € por hora de trabajo
  structureRate: number   // € por hora de trabajo
  structureByCategory: { label: string; amount: number }[]
}

export function computeRates(items: NaveCostItem[], extraStructureMonthly: number, s: CostSettings): Rates {
  const active = items.filter(i => i.active)
  const ticked = new Set(s.labor_item_ids)
  const taxItems = active.filter(isPayrollTax)
  const wages = active.filter(i => i.category === 'personal' && !isPayrollTax(i))
  const producersWages = wages.filter(i => ticked.has(i.id))
  const wagesTotal = wages.reduce((a, i) => a + num(i.monthly_amount), 0)
  const prodWagesTotal = producersWages.reduce((a, i) => a + num(i.monthly_amount), 0)
  const taxTotal = taxItems.reduce((a, i) => a + num(i.monthly_amount), 0)
  const payrollTaxShare = wagesTotal > 0 ? taxTotal * (prodWagesTotal / wagesTotal) : 0
  const laborMonthly = prodWagesTotal + payrollTaxShare

  const structure: Record<string, number> = {}
  const add = (label: string, amount: number) => { structure[label] = (structure[label] ?? 0) + amount }
  for (const i of active) {
    if (isPayrollTax(i)) continue
    if (i.category === 'personal') { if (!ticked.has(i.id)) add('Personal de estructura (administración, limpieza, reparto…)', num(i.monthly_amount)); continue }
    add(LABELS[i.category] ?? 'Otros', num(i.monthly_amount))
  }
  if (taxTotal - payrollTaxShare > 0) add('Personal de estructura (administración, limpieza, reparto…)', taxTotal - payrollTaxShare)
  if (extraStructureMonthly > 0) add('Otros costes mensuales de la nave', extraStructureMonthly)
  const structureByCategory = Object.entries(structure).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
  const structureMonthly = structureByCategory.reduce((a, x) => a + x.amount, 0)

  const producers = producersWages.length
  const productiveHours = producers * num(s.hours_per_person) * (num(s.efficiency_pct) / 100)
  return {
    producers, productiveHours, laborMonthly, payrollTaxShare, structureMonthly, structureByCategory,
    laborRate: productiveHours > 0 ? laborMonthly / productiveHours : 0,
    structureRate: productiveHours > 0 ? structureMonthly / productiveHours : 0,
  }
}

const LABELS: Record<string, string> = {
  suministros: 'Suministros (luz, agua, teléfono)',
  alquiler: 'Alquiler',
  prestamos: 'Hipoteca, préstamos y furgoneta',
  seguros: 'Seguros',
  otros: 'Otros (servicios exteriores…)',
}

export type SheetResult = {
  ingredients: number
  labor: number
  structure: number
  extras: number
  indirect: number
  batchTotal: number
  unitCost: number
  hours: number
  suggestedNet: number      // precio de venta sin IVA
  suggestedGross: (ivaPct: number) => number
  marginOnPricePct: number  // beneficio sobre el precio de venta
  profitPerUnit: number
  ingredientLines: { name: string; cost: number }[]
}

export type ExternalResult = {
  floor: number            // precio suelo: materia prima + trabajo + extras (la estructura ya se paga igual)
  full: number             // coste completo por unidad
  price: number            // tu precio recomendado al distribuidor
  recommendedPvp: number   // PVP al público que le permite al distribuidor su margen
  maxPrice: number | null  // si hay PVP: lo máximo que puedes cobrar al distribuidor
  distMarginReal: number | null // margen real del distribuidor con tu precio y ese PVP
  yourProfit: number
}

export function computeExternal(sheet: CostSheet, r: SheetResult, indirectPct: number): ExternalResult {
  const ext = { ...DEFAULT_EXTERNAL, ...(sheet.external ?? {}) }
  const y = Math.max(num(sheet.yield_qty), 0)
  const floor = y > 0 ? ((r.ingredients + r.labor + r.extras) * (1 + num(indirectPct) / 100)) / y : 0
  const full = r.unitCost
  const price = full * (1 + num(ext.markup_pct) / 100)
  const dm = Math.min(num(ext.dist_margin_pct), 90) / 100
  const pvp = num(ext.pvp)
  return {
    floor, full, price,
    recommendedPvp: dm < 1 ? price / (1 - dm) : 0,
    maxPrice: pvp > 0 ? pvp * (1 - dm) : null,
    distMarginReal: pvp > 0 ? ((pvp - price) / pvp) * 100 : null,
    yourProfit: price - full,
  }
}

// Uso de la nave: horas de trabajo que se van en producir lo que se vende al mes,
// frente a las horas productivas que tiene la nave. Solo cuentan las fichas con
// tiempo de trabajo puesto.
export function computeUsage(sheets: CostSheet[], soldPerMonth: Record<string, number>, rates: Rates) {
  let hours = 0, withTime = 0, soldSheets = 0
  for (const s of sheets) {
    if (!s.product_id) continue
    const units = soldPerMonth[s.product_id] ?? 0
    if (units <= 0) continue
    soldSheets++
    if (!(num(s.minutes) > 0) || !(num(s.yield_qty) > 0)) continue
    withTime++
    hours += units * ((num(s.people) * num(s.minutes)) / 60 / num(s.yield_qty))
  }
  const overhead = rates.laborMonthly + rates.structureMonthly
  const util = rates.productiveHours > 0 ? hours / rates.productiveHours : 0
  const used = Math.min(util, 1)
  return {
    hours, withTime, soldSheets, util, overhead,
    usedCost: overhead * used,
    idleHours: Math.max(0, rates.productiveHours - hours),
    idleCost: overhead * (1 - used),
  }
}

export function computeSheet(sheet: CostSheet, rates: Rates, indirectPct: number): SheetResult {
  const yieldQty = Math.max(num(sheet.yield_qty), 0)
  const ingredientLines = sheet.ingredients.map(i => {
    if (i.kind === 'direct') return { name: i.name, cost: i.per === 'unit' ? num(i.unit_price) * yieldQty : num(i.unit_price) }
    const waste = Math.min(Math.max(num(i.waste_pct), 0), 95) / 100
    return { name: i.name, cost: (num(i.quantity) * num(i.unit_price)) / (1 - waste) }
  })
  const ingredients = ingredientLines.reduce((a, l) => a + l.cost, 0)
  const hours = (num(sheet.people) * num(sheet.minutes)) / 60
  const labor = hours * rates.laborRate
  const structure = hours * rates.structureRate
  const extras = sheet.extras.reduce((a, e) => a + (e.per === 'unit' ? num(e.amount) * yieldQty : num(e.amount)), 0)
  const base = ingredients + labor + structure + extras
  const indirect = base * (num(indirectPct) / 100)
  const batchTotal = base + indirect
  const unitCost = yieldQty > 0 ? batchTotal / yieldQty : 0
  const markup = num(sheet.markup_pct) / 100
  const suggestedNet = unitCost * (1 + markup)
  return {
    ingredients, labor, structure, extras, indirect, batchTotal, unitCost, hours, ingredientLines,
    suggestedNet,
    suggestedGross: (ivaPct: number) => suggestedNet * (1 + ivaPct / 100),
    marginOnPricePct: suggestedNet > 0 ? ((suggestedNet - unitCost) / suggestedNet) * 100 : 0,
    profitPerUnit: suggestedNet - unitCost,
  }
}
