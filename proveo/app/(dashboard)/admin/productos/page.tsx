import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { rowsOf } from '@/lib/serverAccess'
import { splitByProtection, type CategoryLink, type CategoryRow } from '@/lib/protectedCategories'
import { ProductosManager, type Product } from '@/components/products/ProductosManager'
import { isProductsCodeConfigured, isProductsUnlocked } from '@/app/actions/productsGate'
import { requireArea } from '@/lib/areaGuard'

export default async function AdminProductosPage() {
  await requireArea('productos')
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || profile.role === 'nave_manager'

  if (!canEdit) {
    return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>
  }

  const sb = await createClient()

  const [products, categories, links, restaurants, favorites] = await Promise.all([
    sb.from('products')
      .select('id, name, description, price, unit, min_order_quantity, order_increment, is_active, category_id, image_url, cost_price, iva_rate, margin, pending_review, product_categories!products_category_id_fkey(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index, is_protected').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
    sb.from('organizations').select('id, name').eq('type', 'restaurante').order('name'),
    sb.from('restaurant_favorite_products').select('organization_id, product_id'),
  ])

  // Si no se pueden leer las categorías no se sabe cuáles están protegidas: no se muestra
  // nada (mejor un error que enseñar precios protegidos).
  if (categories.error) {
    console.error('Error cargando categorías:', categories.error)
    return <div className="p-6"><p className="text-red-600">No se pudieron cargar las categorías. Recarga la página.</p></div>
  }
  if (products.error) console.error('Error cargando productos:', products.error)

  const [codeConfigured, unlocked] = await Promise.all([isProductsCodeConfigured(), isProductsUnlocked()])
  const categoryRows = rowsOf<CategoryRow>(categories)
  const { visible, locked } = splitByProtection(rowsOf<Product>(products), categoryRows, rowsOf<CategoryLink>(links), unlocked)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ProductosManager
        products={visible}
        categories={categoryRows}
        restaurants={rowsOf<{ id: string; name: string }>(restaurants)}
        favorites={rowsOf<{ organization_id: string; product_id: string }>(favorites)}
        isNave
        gate={{ codeConfigured, unlocked, locked }}
      />
    </div>
  )
}
