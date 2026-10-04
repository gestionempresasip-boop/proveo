// Cálculos financieros de Informes, en un solo sitio para que TODAS las
// pantallas (Situación, Punto muerto, Rentabilidad de restaurantes) den las
// mismas cifras. Son funciones puras: reciben datos y devuelven números.
//
// Criterio de la nave: lo que compran los restaurantes es INGRESO de la nave
// (neto de IVA). Para el restaurante esa misma cantidad es GASTO.

export type FinLine = {
  order_id: string
  created_at: string
  restaurant_id: string
  item_total: number   // con IVA
  iva_rate: number
  quantity: number
  cost_price: number   // coste unitario del producto para la nave (0 = sin registrar)
}

export type CostItem = {
  id: string
  organization_id: string
  kind: 'fijo' | 'variable'
  mode: 'monthly' | 'percent'
  name: string
  value: number
  active: boolean
}

export type MonthlySale = { organization_id: string; month: string; amount: number }

export const netOfIva = (l: FinLine) => l.item_total / (1 + (l.iva_rate || 0))

const DAY = 86400000

export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function monthStart(year: number, month: number) { return new Date(year, month, 1) }
export function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
export function ymKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export type Range = { from: Date; to: Date } // from incluido, to EXCLUIDO

export function monthRange(year: number, month: number): Range {
  return { from: monthStart(year, month), to: monthStart(year, month + 1) }
}

/** "Meses equivalentes" que cubre el rango: un mes entero = 1, medio mes ≈ 0,5... */
export function monthsCovered(r: Range): number {
  let total = 0
  const cur = new Date(r.from.getFullYear(), r.from.getMonth(), 1)
  while (cur < r.to) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const a = cur > r.from ? cur : r.from
    const b = next < r.to ? next : r.to
    const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY))
    total += days / daysInMonth(cur.getFullYear(), cur.getMonth())
    cur.setMonth(cur.getMonth() + 1)
  }
  return total
}

/** Ventas del rango sumando cada mes (proporcional a los días del mes que entran). */
export function salesInRange(sales: MonthlySale[], orgId: string, r: Range): { amount: number; monthsWithData: number; monthsTotal: number } {
  const byMonth = new Map<string, number>()
  for (const s of sales) if (s.organization_id === orgId) byMonth.set(s.month.slice(0, 7), Number(s.amount))
  let amount = 0, withData = 0, total = 0
  const cur = new Date(r.from.getFullYear(), r.from.getMonth(), 1)
  while (cur < r.to) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const a = cur > r.from ? cur : r.from
    const b = next < r.to ? next : r.to
    const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY))
    const frac = days / daysInMonth(cur.getFullYear(), cur.getMonth())
    total += frac
    const v = byMonth.get(ymKey(cur))
    if (v != null) { amount += v * frac; withData += frac }
    cur.setMonth(cur.getMonth() + 1)
  }
  return { amount, monthsWithData: withData, monthsTotal: total }
}

/** Margen de contribución histórico (sobre las líneas con coste registrado). */
export function contributionRatio(lines: FinLine[]): number | null {
  let rev = 0, cost = 0
  for (const l of lines) {
    if (l.cost_price > 0) { rev += netOfIva(l); cost += l.cost_price * l.quantity }
  }
  return rev > 0 ? (rev - cost) / rev : null
}

export function linesInRange(lines: FinLine[], r: Range, restaurantId?: string): FinLine[] {
  return lines.filter(l => {
    const d = new Date(l.created_at)
    return d >= r.from && d < r.to && (!restaurantId || restaurantId === 'todos' || l.restaurant_id === restaurantId)
  })
}

// ── NAVE ─────────────────────────────────────────────────────────────────

export type NaveAnalysis = {
  revenueNet: number          // ingresos de la nave (ventas a restaurantes, sin IVA)
  revenueGross: number
  orders: number
  cogs: number | null         // coste de producto
  otherVariable: number       // otros variables (transporte, envases…): € al mes + % de ventas
  fixed: number               // costes fijos prorrateados al rango
  totalCosts: number | null
  profit: number | null
  profitPct: number | null    // beneficio / ingresos
  contributionRatio: number | null
  breakEvenNet: number | null // ingresos necesarios para no perder
  pctToBreakEven: number | null
  missingToBreakEven: number | null
  coveragePct: number | null  // % de ingresos que viene de productos con coste registrado
  months: number
  perEuro: number | null      // lo que deja cada € vendido tras coste de producto y % variables
  lump: number                // costes de importe fijo del rango (fijos + variables en €/mes)
}

export function analyzeNave(args: {
  lines: FinLine[]
  range: Range
  naveFixedMonthly: number
  naveItems: CostItem[]        // otros costes de la nave (variable, mode monthly|percent)
  ratio: number | null         // margen de contribución histórico
}): NaveAnalysis {
  const { lines, range, naveFixedMonthly, naveItems, ratio } = args
  const inRange = linesInRange(lines, range)
  const months = monthsCovered(range)

  const revenueNet = inRange.reduce((s, l) => s + netOfIva(l), 0)
  const revenueGross = inRange.reduce((s, l) => s + l.item_total, 0)
  const orders = new Set(inRange.map(l => l.order_id)).size
  const withCost = inRange.reduce((s, l) => s + (l.cost_price > 0 ? netOfIva(l) : 0), 0)
  const coveragePct = revenueNet > 0 ? (withCost / revenueNet) * 100 : null

  const active = naveItems.filter(i => i.active)
  const pctSum = active.filter(i => i.mode === 'percent').reduce((s, i) => s + i.value, 0) / 100
  const monthlyVariable = active.filter(i => i.mode === 'monthly').reduce((s, i) => s + i.value, 0)
  const otherVariable = revenueNet * pctSum + monthlyVariable * months

  const fixed = naveFixedMonthly * months
  const cogs = ratio != null ? revenueNet * (1 - ratio) : null
  const totalCosts = cogs != null ? cogs + otherVariable + fixed : null
  const profit = totalCosts != null ? revenueNet - totalCosts : null

  // Punto muerto: los costes "de importe fijo" (fijos + variables en €/mes) se
  // cubren con lo que queda de cada euro vendido tras coste de producto y % variables.
  const perEuro = ratio != null ? ratio - pctSum : null
  const lump = fixed + monthlyVariable * months
  const breakEvenNet = perEuro != null && perEuro > 0 ? lump / perEuro : null

  return {
    revenueNet, revenueGross, orders, cogs, otherVariable, fixed, totalCosts, profit,
    profitPct: profit != null && revenueNet > 0 ? (profit / revenueNet) * 100 : null,
    contributionRatio: ratio,
    breakEvenNet,
    pctToBreakEven: breakEvenNet != null && breakEvenNet > 0 ? (revenueNet / breakEvenNet) * 100 : null,
    missingToBreakEven: breakEvenNet != null ? Math.max(0, breakEvenNet - revenueNet) : null,
    coveragePct,
    months,
    perEuro,
    lump,
  }
}

/** Ingresos netos acumulados día a día dentro del rango (para la curva del punto muerto). */
export function dailyCumulative(lines: FinLine[], range: Range): { day: number; label: string; cumulative: number }[] {
  const inRange = linesInRange(lines, range)
  const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY))
  const perDay = new Array(totalDays).fill(0)
  for (const l of inRange) {
    const idx = Math.floor((startOfDay(new Date(l.created_at)).getTime() - range.from.getTime()) / DAY)
    if (idx >= 0 && idx < totalDays) perDay[idx] += netOfIva(l)
  }
  let acc = 0
  return perDay.map((v, i) => {
    acc += v
    const d = new Date(range.from.getTime() + i * DAY)
    return { day: i + 1, label: `${d.getDate()}/${d.getMonth() + 1}`, cumulative: Math.round(acc) }
  })
}

// ── RESTAURANTES ─────────────────────────────────────────────────────────

export type RestaurantAnalysis = {
  purchasesNet: number          // gasto en la nave (compras, sin IVA)
  sales: number | null          // ventas del restaurante (introducidas por la nave)
  salesMonthsWithData: number
  salesMonthsTotal: number
  otherVariable: number
  fixed: number
  totalCosts: number
  profit: number | null
  profitPct: number | null      // rentabilidad: beneficio / ventas
  naveShare: number | null      // qué % de sus ventas se va en comprar a la nave
  breakEvenSales: number | null // ventas necesarias para no perder
}

export function analyzeRestaurant(args: {
  lines: FinLine[]
  range: Range
  restaurantId: string
  sales: MonthlySale[]
  items: CostItem[]            // costes de ese restaurante
}): RestaurantAnalysis {
  const { lines, range, restaurantId, sales, items } = args
  const purchasesNet = linesInRange(lines, range, restaurantId).reduce((s, l) => s + netOfIva(l), 0)
  const s = salesInRange(sales, restaurantId, range)
  const hasSales = s.monthsWithData > 0
  const salesAmount = hasSales ? s.amount : null
  const months = monthsCovered(range)

  const active = items.filter(i => i.active && i.organization_id === restaurantId)
  const fixedItems = active.filter(i => i.kind === 'fijo')
  const varItems = active.filter(i => i.kind === 'variable')
  const fixed = fixedItems.reduce((a, i) => a + (i.mode === 'monthly' ? i.value * months : (salesAmount ?? 0) * i.value / 100), 0)
  const varPct = varItems.filter(i => i.mode === 'percent').reduce((a, i) => a + i.value, 0) / 100
  const varMonthly = varItems.filter(i => i.mode === 'monthly').reduce((a, i) => a + i.value * months, 0)
  const otherVariable = (salesAmount ?? 0) * varPct + varMonthly

  const totalCosts = purchasesNet + otherVariable + fixed
  const profit = salesAmount != null ? salesAmount - totalCosts : null

  // Punto muerto en ventas: cada € vendido deja (1 − % compras a la nave − % variables)
  const purchasesPct = salesAmount != null && salesAmount > 0 ? purchasesNet / salesAmount : null
  const perEuro = purchasesPct != null ? 1 - purchasesPct - varPct : null
  const lump = fixed + varMonthly
  const breakEvenSales = perEuro != null && perEuro > 0 ? lump / perEuro : null

  return {
    purchasesNet, sales: salesAmount,
    salesMonthsWithData: s.monthsWithData, salesMonthsTotal: s.monthsTotal,
    otherVariable, fixed, totalCosts, profit,
    profitPct: profit != null && salesAmount! > 0 ? (profit / salesAmount!) * 100 : null,
    naveShare: purchasesPct != null ? purchasesPct * 100 : null,
    breakEvenSales,
  }
}

// ── Utilidades de presentación ───────────────────────────────────────────

export function eur(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—'
  return `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`
}

export function pct(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—'
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}

export function monthLabel(year: number, month: number): string {
  const s = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
