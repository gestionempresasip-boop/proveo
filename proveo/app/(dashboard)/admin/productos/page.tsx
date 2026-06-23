import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { ProductosManager } from '@/components/products/ProductosManager'

export default async function AdminProductosPage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || profile.role === 'nave_manager'

  if (!canEdit) {
    return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>
  }

  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: products, error: productsError }, { data: categories }, { data: links }] = await Promise.all([
    sb.from('products')
      .select('id, name, description, price, unit, min_order_quantity, order_increment, is_active, category_id, image_url, cost_price, iva_rate, margin, pending_review, product_categories(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
  ])

  if (productsError) {
    console.error('Error cargando productos:', productsError)
  }

  const categoryIdsByProduct = new Map<string, string[]>()
  for (const link of links ?? []) {
    const list = categoryIdsByProduct.get(link.product_id) ?? []
    list.push(link.category_id)
    categoryIdsByProduct.set(link.product_id, list)
  }

  const productsWithCats = (products ?? []).map((p: any) => ({
    ...p,
    category_ids: categoryIdsByProduct.get(p.id) ?? [],
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ProductosManager products={productsWithCats} categories={categories ?? []} isNave />
    </div>
  )
}
