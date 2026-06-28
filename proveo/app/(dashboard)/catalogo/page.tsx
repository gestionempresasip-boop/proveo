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

  const [{ data: prods }, { data: cats }, { data: stock }, { data: favs }] = await Promise.all([
    sb.from('products').select('*, product_categories!products_category_id_fkey(name, color)').eq('is_active', true).is('deleted_at', null).order('name'),
    sb.from('product_categories').select('*').order('order_index').order('name'),
    sb.from('nave_inventory').select('product_id, current_stock, last_restocked_at'),
    sb.from('restaurant_favorite_products').select('product_id').eq('organization_id', profile.organization_id),
  ])

  return (
    <CatalogoClient
      initialProducts={prods ?? []}
      initialCategories={cats ?? []}
      initialStock={stock ?? []}
      initialFavoriteIds={(favs ?? []).map((f: { product_id: string }) => f.product_id)}
      organizationId={profile.organization_id}
      userId={profile.id}
    />
  )
}
