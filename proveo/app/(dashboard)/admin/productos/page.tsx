import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/fetchAll'
import { rowsOf } from '@/lib/serverAccess'
import { splitByProtection, type CategoryLink, type CategoryRow } from '@/lib/protectedCategories'
import { ProductosManager, type Product } from '@/components/products/ProductosManager'
import { ProductosGate } from '@/components/products/ProductosGate'
import { isProductsCodeConfigured, isProductsUnlocked } from '@/app/actions/productsGate'

export default async function AdminProductosPage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || profile.role === 'nave_manager'

  if (!canEdit) {
    return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>
  }

  // Toda la pestaña pide su clave: sin ella no se piden precios, costes ni márgenes.
  const [codeConfigured, unlocked] = await Promise.all([isProductsCodeConfigured(), isProductsUnlocked()])
  if (!unlocked) return <ProductosGate configured={codeConfigured} />

  const sb = await createClient()

  const [products, categories, links, restaurants, favorites] = await Promise.all([
    sb.from('products')
      .select('id, name, description, price, unit, min_order_quantity, order_increment, is_active, category_id, image_url, cost_price, iva_rate, margin, pending_review, allows_box_order, box_units, box_label, product_categories!products_category_id_fkey(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index, is_protected').order('order_index').order('name'),
    fetchAll<CategoryLink>((a, b) => sb.from('product_category_links').select('product_id, category_id').order('product_id').order('category_id').range(a, b)),
    sb.from('organizations').select('id, name, is_external').eq('type', 'restaurante').order('name'),
    sb.from('restaurant_favorite_products').select('organization_id, product_id'),
  ])

  // Si no se pueden leer las categorías no se sabe cuáles están protegidas: no se muestra
  // nada (mejor un error que enseñar precios protegidos).
  if (categories.error) {
    console.error('Error cargando categorías:', categories.error)
    return <div className="p-6"><p className="text-red-600">No se pudieron cargar las categorías. Recarga la página.</p></div>
  }
  if (products.error) console.error('Error cargando productos:', products.error)

  const categoryRows = rowsOf<CategoryRow>(categories)
  const { visible: visibleBase, locked } = splitByProtection(rowsOf<Product>(products), categoryRows, links, unlocked)

  // Notas internas (solo nave). Si la tabla aún no existe (falta ejecutar el SQL) el campo simplemente no aparece.
  const notesRes = await sb.from('product_internal_notes').select('product_id, notes')
  const notesEnabled = !notesRes.error
  const notesById = new Map<string, string>(((notesRes.data ?? []) as { product_id: string; notes: string }[]).map(n => [n.product_id, n.notes]))
  // Stock de la nave (para la exportación). Si no se puede leer, esas columnas salen vacías.
  const invRes = await sb.from('nave_inventory').select('product_id, current_stock, min_stock')
  const invById = new Map<string, { stock: number; min: number }>(((invRes.data ?? []) as { product_id: string; current_stock: number; min_stock: number }[]).map(r => [r.product_id, { stock: Number(r.current_stock), min: Number(r.min_stock) }]))
  const visible = visibleBase.map(p => ({ ...p, notes_enabled: notesEnabled, internal_notes: notesById.get(p.id) ?? '', stock: invById.get(p.id)?.stock ?? null, min_stock: invById.get(p.id)?.min ?? null }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ProductosManager
        products={visible}
        categories={categoryRows}
        restaurants={rowsOf<{ id: string; name: string; is_external?: boolean | null }>(restaurants).filter(r => !r.is_external)}
        favorites={rowsOf<{ organization_id: string; product_id: string }>(favorites)}
        isNave
        gate={{ codeConfigured, unlocked, locked }}
      />
    </div>
  )
}
