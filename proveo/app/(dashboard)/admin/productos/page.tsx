import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { ProductosManager } from '@/components/products/ProductosManager'
import { isProductsCodeConfigured, isProductsUnlocked } from '@/app/actions/productsGate'

export default async function AdminProductosPage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || profile.role === 'nave_manager'

  if (!canEdit) {
    return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>
  }

  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: products, error: productsError }, { data: categories }, { data: links }, { data: restaurants }, { data: favorites }] = await Promise.all([
    sb.from('products')
      .select('id, name, description, price, unit, min_order_quantity, order_increment, is_active, category_id, image_url, cost_price, iva_rate, margin, pending_review, product_categories!products_category_id_fkey(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index, is_protected').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
    sb.from('organizations').select('id, name').eq('type', 'restaurante').order('name'),
    sb.from('restaurant_favorite_products').select('organization_id, product_id'),
  ])

  // Si la migración de categorías protegidas aún no está aplicada, la columna no
  // existe y esa consulta falla: se cae a la consulta de siempre, sin protección.
  let categoryRows: any[] = categories ?? []
  if (!categories) {
    const { data: plain } = await sb.from('product_categories').select('id, name, color, order_index').order('order_index').order('name')
    categoryRows = plain ?? []
  }

  if (productsError) {
    console.error('Error cargando productos:', productsError)
  }

  const categoryIdsByProduct = new Map<string, string[]>()
  for (const link of links ?? []) {
    const list = categoryIdsByProduct.get(link.product_id) ?? []
    list.push(link.category_id)
    categoryIdsByProduct.set(link.product_id, list)
  }

  const [codeConfigured, unlocked] = await Promise.all([isProductsCodeConfigured(), isProductsUnlocked()])
  const protectedIds = new Set(categoryRows.filter(c => c.is_protected).map(c => c.id))

  // Bloqueado: los productos de categorías protegidas NO salen del servidor.
  const isHidden = (p: any) => !unlocked && (
    (p.category_id && protectedIds.has(p.category_id)) ||
    (categoryIdsByProduct.get(p.id) ?? []).some(id => protectedIds.has(id))
  )
  const lockedCounts = new Map<string, number>()
  const visible: any[] = []
  for (const p of products ?? []) {
    if (isHidden(p)) {
      const ids = new Set<string>([p.category_id, ...(categoryIdsByProduct.get(p.id) ?? [])].filter(Boolean))
      for (const id of ids) if (protectedIds.has(id)) lockedCounts.set(id, (lockedCounts.get(id) ?? 0) + 1)
    } else visible.push(p)
  }
  const lockedCategories = unlocked ? [] : categoryRows
    .filter(c => protectedIds.has(c.id))
    .map(c => ({ id: c.id, name: c.name, color: c.color, count: lockedCounts.get(c.id) ?? 0 }))

  const productsWithCats = visible.map((p: any) => ({
    ...p,
    category_ids: categoryIdsByProduct.get(p.id) ?? [],
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ProductosManager
        products={productsWithCats}
        categories={categoryRows}
        restaurants={restaurants ?? []}
        favorites={favorites ?? []}
        isNave
        gate={{ codeConfigured, unlocked, locked: lockedCategories }}
      />
    </div>
  )
}
