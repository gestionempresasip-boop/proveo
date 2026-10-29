import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { CatalogoClient } from '@/components/products/CatalogoClient'
import { createAdminClient } from '@/lib/supabase/admin'

// Server Component: trae productos/categorías/stock/favoritos en el
// servidor (en paralelo) en vez de pedirlos desde el navegador tras montar
// el componente. Quita 4 idas y vueltas a Supabase de cada visita a esta
// pantalla (la más usada de la app) y aprovecha el caché de getAuthProfile
// que ya usa el layout del dashboard.
// Solo las columnas que usa el catálogo. Nunca se mandan al navegador el coste ni el margen (el catálogo lo ven los restaurantes).
const PRODUCT_COLS = 'id, category_id, name, description, image_url, price, unit, min_order_quantity, order_increment, visibility, is_active, iva_rate, allows_box_order, box_units, box_label'

export default async function CatalogoPage() {
  const profile = await getAuthProfile()
  const supabase = await createClient()
  const sb = supabase as any

  const today = new Date().toISOString().split('T')[0]
  const isExternal = !!profile.organizations.is_external

  // Cliente externo (distribuidor): solo los productos que la nave le ha asignado, a su precio, sin
  // promociones del grupo. Se piden en el servidor con la clave de servicio para poder incluir productos
  // ocultos a los restaurantes (que son justo los de venta exterior); el filtro es SIEMPRE por su organización.
  if (isExternal) {
    const admin = createAdminClient() as any
    const { data: assigned } = await admin.from('client_product_prices').select('product_id, price').eq('organization_id', profile.organization_id)
    const priceById = new Map<string, number>((assigned ?? []).map((r: any) => [r.product_id, Number(r.price)]))
    const ids = [...priceById.keys()]
    const none = { data: [] as any[] }
    const [{ data: xProds }, { data: xCats }, { data: xLinks }, { data: xFavs }, { data: xCart }] = await Promise.all([
      ids.length ? admin.from('products').select(`${PRODUCT_COLS}, product_categories!products_category_id_fkey(name, color)`).in('id', ids).is('deleted_at', null).order('name') : none,
      admin.from('product_categories').select('*').order('order_index').order('name'),
      ids.length ? admin.from('product_category_links').select('product_id, category_id').in('product_id', ids) : none,
      admin.from('restaurant_favorite_products').select('product_id').eq('organization_id', profile.organization_id),
      admin.from('pending_carts').select('*').eq('organization_id', profile.organization_id).maybeSingle(),
    ])
    const catIdsByProduct = new Map<string, string[]>()
    for (const l of xLinks ?? []) catIdsByProduct.set(l.product_id, [...(catIdsByProduct.get(l.product_id) ?? []), l.category_id])
    const extProducts = (xProds ?? []).map((p: any) => ({
      ...p,
      price: priceById.get(p.id) ?? p.price,
      is_active: true,
      category_ids: catIdsByProduct.get(p.id) ?? (p.category_id ? [p.category_id] : []),
    }))
    const usedCats = new Set<string>(extProducts.flatMap((p: any) => p.category_ids))
    return (
      <CatalogoClient
        initialProducts={extProducts}
        initialCategories={(xCats ?? []).filter((c: any) => usedCats.has(c.id))}
        // Sin stock: el cliente externo no ve lo que queda en la nave y puede pedir lo asignado aunque no haya
        initialStock={[]}
        initialFavoriteIds={(xFavs ?? []).map((f: { product_id: string }) => f.product_id)}
        initialPromotions={[]}
        initialPendingCart={xCart ? {
          cart: xCart.cart ?? {},
          cartModes: xCart.cart_modes ?? {},
          cartBoxUnits: xCart.cart_box_units ?? {},
          notes: xCart.notes ?? '',
          destination: xCart.destination ?? '',
          updatedByName: xCart.updated_by_name ?? null,
          updatedByMe: xCart.updated_by === profile.id,
          updatedAt: xCart.updated_at,
        } : null}
        organizationId={profile.organization_id}
        userId={profile.id}
        userName={profile.full_name ?? null}
        showPrices
      />
    )
  }

  const [{ data: prods }, { data: cats }, { data: links }, { data: stock }, { data: favs }, { data: promos }, { data: pendingCart }] = await Promise.all([
    sb.from('products').select(`${PRODUCT_COLS}, product_categories!products_category_id_fkey(name, color)`).eq('is_active', true).is('deleted_at', null).order('name'),
    sb.from('product_categories').select('*').order('order_index').order('name'),
    sb.from('product_category_links').select('product_id, category_id'),
    sb.from('nave_inventory').select('product_id, current_stock, last_restocked_at'),
    sb.from('restaurant_favorite_products').select('product_id').eq('organization_id', profile.organization_id),
    sb.from('promotions')
      .select(`*, products(${PRODUCT_COLS}, product_categories!products_category_id_fkey(name, color))`)
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('created_at', { ascending: false }),
    sb.from('pending_carts').select('*').eq('organization_id', profile.organization_id).maybeSingle(),
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
      initialPendingCart={pendingCart ? {
        cart: pendingCart.cart ?? {},
        cartModes: pendingCart.cart_modes ?? {},
        cartBoxUnits: pendingCart.cart_box_units ?? {},
        notes: pendingCart.notes ?? '',
        destination: pendingCart.destination ?? '',
        updatedByName: pendingCart.updated_by_name ?? null,
        updatedByMe: pendingCart.updated_by === profile.id,
        updatedAt: pendingCart.updated_at,
      } : null}
      organizationId={profile.organization_id}
      userId={profile.id}
      userName={profile.full_name ?? null}
    />
  )
}
