import Link from 'next/link'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/fetchAll'
import { ProductosGate } from '@/components/products/ProductosGate'
import { CambiosCosteClient, type PriceLogRow } from '@/components/products/CambiosCosteClient'
import { isProductsCodeConfigured, isProductsUnlocked } from '@/app/actions/productsGate'

export default async function CambiosCostePage() {
  const profile = await getAuthProfile()
  const canEdit = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!canEdit) return <div className="p-6"><p className="text-red-600">Sin permisos.</p></div>

  // Son costes y precios: misma clave que la pestaña Productos.
  const [codeConfigured, unlocked] = await Promise.all([isProductsCodeConfigured(), isProductsUnlocked()])
  if (!unlocked) return <ProductosGate configured={codeConfigured} />

  const sb = (await createClient()) as any
  const cols = 'id, product_id, product_name, unit, old_cost, new_cost, old_price, new_price, changed_at, billed_at'

  let tableMissing = false
  let pending: PriceLogRow[] = []
  let history: PriceLogRow[] = []
  try {
    pending = await fetchAll<PriceLogRow>((a, b) =>
      sb.from('product_price_log').select(cols).is('billed_at', null).order('changed_at', { ascending: false }).order('id').range(a, b))
    const h = await sb.from('product_price_log').select(cols).order('changed_at', { ascending: false }).limit(500)
    if (h.error) throw h.error
    history = (h.data ?? []) as PriceLogRow[]
  } catch (e) {
    console.error('Registro de cambios de precio:', e)
    tableMissing = true
  }

  const num = (v: unknown) => (v == null ? null : Number(v))
  const norm = (r: PriceLogRow): PriceLogRow => ({
    ...r, old_cost: num(r.old_cost), new_cost: num(r.new_cost), old_price: num(r.old_price), new_price: num(r.new_price),
  })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <Link href="/admin/productos" className="text-sm text-gray-700 hover:text-black">← Volver a Productos</Link>
      <CambiosCosteClient pending={pending.map(norm)} history={history.map(norm)} tableMissing={tableMissing} />
    </div>
  )
}
