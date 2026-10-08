// Categorías protegidas con código (Productos): qué productos pueden salir del servidor.
// Pura y sin acceso a datos, para poder razonar sobre ella: si el código no está
// introducido, los productos de una categoría protegida NO se devuelven.

export type CategoryRow = { id: string; name: string; color: string | null; order_index: number | null; is_protected?: boolean }
export type CategoryLink = { product_id: string; category_id: string }
export type LockedCategory = { id: string; name: string; color: string | null; count: number }

export function splitByProtection<P extends { id: string; category_id: string | null }>(
  products: P[], categories: CategoryRow[], links: CategoryLink[], unlocked: boolean,
): { visible: (P & { category_ids: string[] })[]; locked: LockedCategory[] } {
  const idsByProduct = new Map<string, string[]>()
  for (const l of links) idsByProduct.set(l.product_id, [...(idsByProduct.get(l.product_id) ?? []), l.category_id])

  const protectedIds = new Set(categories.filter(c => c.is_protected).map(c => c.id))
  const lockedCounts = new Map<string, number>()
  const visible: (P & { category_ids: string[] })[] = []

  for (const p of products) {
    const categoryIds = idsByProduct.get(p.id) ?? []
    const own = new Set([...(p.category_id ? [p.category_id] : []), ...categoryIds])
    const hit = [...own].filter(id => protectedIds.has(id))
    if (!unlocked && hit.length > 0) {
      for (const id of hit) lockedCounts.set(id, (lockedCounts.get(id) ?? 0) + 1)
    } else {
      visible.push({ ...p, category_ids: categoryIds })
    }
  }

  const locked = unlocked ? [] : categories
    .filter(c => protectedIds.has(c.id))
    .map(c => ({ id: c.id, name: c.name, color: c.color, count: lockedCounts.get(c.id) ?? 0 }))
  return { visible, locked }
}
