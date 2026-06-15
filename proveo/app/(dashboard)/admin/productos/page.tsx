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

  const [{ data: products }, { data: categories }] = await Promise.all([
    sb.from('products')
      .select('id, name, description, price, unit, min_order_quantity, order_increment, is_active, category_id, image_url, product_categories(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index').order('order_index').order('name'),
  ])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ProductosManager products={products ?? []} categories={categories ?? []} />
    </div>
  )
}
