// Precio recomendado (sin IVA) por tipo de cliente. Funciones puras.
//
// Método (el que usa la nave):
//   coste completo = (materia prima + mano de obra + indirectos) por unidad
//     · mano de obra = horas de trabajo de la tanda × €/hora ÷ unidades de la tanda
//     · indirectos   = % sobre (materia prima + mano de obra): luz y otros costes
//   precio = coste completo × (1 + recargo del tipo de cliente)
//
// Tres tipos de cliente, de más a menos margen:
//   directo       → cliente final / venta directa (tarifa completa)
//   grupo         → los restaurantes del grupo
//   distribuidor  → los clientes de la pestaña Clientes (compran volumen y revenden)

export type PricingAssumptions = {
  laborRate: number       // € por hora de trabajo
  indirectPct: number     // % de costes indirectos
  directoPct: number      // recargo sobre el coste completo
  grupoPct: number
  distribuidorPct: number
  distMarginPct: number   // margen que se queda el distribuidor al revender (para el PVP orientativo)
}

export const DEFAULT_ASSUMPTIONS: PricingAssumptions = {
  laborRate: 9,
  indirectPct: 8,
  directoPct: 45,
  grupoPct: 30,
  distribuidorPct: 20,
  distMarginPct: 30,
}

export type Tier = {
  key: 'directo' | 'grupo' | 'distribuidor'
  price: number              // precio recomendado sin IVA
  marginOnPricePct: number   // beneficio sobre el precio de venta
  profit: number             // beneficio por unidad
}

export type Recommendation = {
  materia: number
  labor: number
  indirect: number
  fullCost: number
  hasLabor: boolean
  tiers: Record<Tier['key'], Tier>
  distributorPvp: number     // a cuánto vendería el distribuidor (sin IVA) con su margen
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }

// Por debajo de 1 € se afinan los céntimos (croquetas a 0,34 €): 3 decimales; desde 1 €, céntimos.
export function roundPrice(x: number): number {
  return x >= 1 ? Math.round(x * 100) / 100 : Math.round(x * 1000) / 1000
}

export function recommendPrices(
  input: { materia: number; batchUnits: number; laborHours: number },
  a: PricingAssumptions,
): Recommendation | null {
  const materia = num(input.materia)
  const hasLabor = num(input.batchUnits) > 0 && num(input.laborHours) > 0
  const labor = hasLabor ? (num(input.laborHours) * num(a.laborRate)) / num(input.batchUnits) : 0
  const base = materia + labor
  if (!(base > 0)) return null
  const indirect = base * (num(a.indirectPct) / 100)
  const fullCost = base + indirect

  const tier = (key: Tier['key'], pct: number): Tier => {
    const price = roundPrice(fullCost * (1 + num(pct) / 100))
    return { key, price, profit: price - fullCost, marginOnPricePct: price > 0 ? ((price - fullCost) / price) * 100 : 0 }
  }
  const tiers = {
    directo: tier('directo', a.directoPct),
    grupo: tier('grupo', a.grupoPct),
    distribuidor: tier('distribuidor', a.distribuidorPct),
  }
  const dm = Math.min(num(a.distMarginPct), 90) / 100
  return { materia, labor, indirect, fullCost, hasLabor, tiers, distributorPvp: roundPrice(tiers.distribuidor.price / (1 - dm)) }
}
