import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { rowsOf } from '@/lib/serverAccess'
import { splitByProtection, type CategoryLink, type CategoryRow } from '@/lib/protectedCategories'
import { ProductosGate } from '@/components/products/ProductosGate'
import { isProductsCodeConfigured, isProductsUnlocked } from '@/app/actions/productsGate'
import { ClientesExternosManager, type ExternalClient, type ClientProduct } from '@/components/clients/ClientesExternosManager'

export default async function AdminClientesPage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!canEdit) return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>

  // Aquí se ven y se fijan precios: misma clave que la pestaña Productos.
  const [codeConfigured, unlocked] = await Promise.all([isProductsCodeConfigured(), isProductsUnlocked()])
  if (!unlocked) return <ProductosGate configured={codeConfigured} />

  const sb = await createClient()
  const [orgs, products, categories, links, prices] = await Promise.all([
    sb.from('organizations').select('id, name, fiscal_name, tax_id, address, phone, login_slug').eq('is_external', true).order('name'),
    sb.from('products')
      .select('id, name, price, unit, iva_rate, is_active, category_id, product_categories!products_category_id_fkey(name)')
      .is('deleted_at', null)
      .order('name'),
    sb.from('product_categories').select('id, name, color, order_index, is_protected').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
    sb.from('client_product_prices').select('organization_id, product_id, price'),
  ])

  // Si falta el SQL (la columna o la tabla no existen) se explica en vez de romper la pantalla.
  const sqlMissing = !!orgs.error || !!prices.error
  if (categories.error || products.error) {
    return <div className="p-6"><p className="text-red-600">No se pudieron cargar los productos. Recarga la página.</p></div>
  }

  const categoryRows = rowsOf<CategoryRow>(categories)
  const { visible } = splitByProtection(
    rowsOf<{ id: string; name: string; price: number; unit: string; iva_rate: number | null; is_active: boolean; category_id: string | null; product_categories: { name: string } | null }>(products),
    categoryRows, rowsOf<CategoryLink>(links), unlocked,
  )
  const catalog: ClientProduct[] = visible.map(p => ({
    id: p.id, name: p.name, unit: p.unit, price: Number(p.price) || 0, iva: Number(p.iva_rate) || 0,
    active: p.is_active, category: p.product_categories?.name ?? null,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ClientesExternosManager
        clients={sqlMissing ? [] : rowsOf<ExternalClient>(orgs)}
        catalog={catalog}
        prices={sqlMissing ? [] : rowsOf<{ organization_id: string; product_id: string; price: number }>(prices)}
        sqlMissing={sqlMissing}
      />
    </div>
  )
}
