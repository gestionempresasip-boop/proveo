import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { CatalogoClient } from '@/components/products/CatalogoClient'

// Server Component: trae productos/categorías/stock/favoritos en el
// servidor (en paralelo) en vez de pedirlos desde el navegador tras montar
// el componente. Quita 4 idas y vueltas a Supabase de cada visita a esta
// pantalla (la más usada de la app) y aprovecha el caché de getAuthProfile
// que ya usa el layout del dashboard.
export default async function CatalogoPage() {
  const profile = await getAuthProfile()
  const supabase = await createClient()
  const sb = supabase as any

  const today = new Date().toISOString().split('T')[0]

  const [{ data: prods }, { data: cats }, { data: links }, { data: stock }, { data: favs }, { data: promos }] = await Promise.all([
    sb.from('products').select('*, product_categories!products_category_id_fkey(name, color)').eq('is_active', true).is('deleted_at', null).order('name'),
    sb.from('product_categories').select('*').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
    sb.from('nave_inventory').select('product_id, current_stock, last_restocked_at'),
    sb.from('restaurant_favorite_products').select('product_id').eq('organization_id', profile.organization_id),
    sb.from('promotions')
      .select('*, products(*, product_categories!products_category_id_fkey(name, color))')
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('created_at', { ascending: false }),
  ])

  // Un producto puede estar en varias categorías (tabla puente
  // product_category_links). Adjuntamos todas las categorías a cada producto
  // para que el catálogo lo muestre en cada una, no solo en su category_id.
  const categoryIdsByProduct = new Map<string, string[]>()
  for (const link of links ?? []) {
    const list = categoryIdsByProduct.get(link.product_id) ?? []
    list.push(link.category_id)
    categoryIdsByProduct.set(link.product_id, list)
  }
  const prodsWithCats = (prods ?? []).map((p: any) => ({
    ...p,
    category_ids: categoryIdsByProduct.get(p.id) ?? (p.category_id ? [p.category_id] : []),
  }))

  return (
    <CatalogoClient
      initialProducts={prodsWithCats}
      initialCategories={cats ?? []}
      initialStock={stock ?? []}
      initialFavoriteIds={(favs ?? []).map((f: { product_id: string }) => f.product_id)}
      initialPromotions={promos ?? []}
      organizationId={profile.organization_id}
      userId={profile.id}
    />
  )
}
