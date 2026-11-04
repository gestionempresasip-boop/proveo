import Link from 'next/link'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/fetchAll'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const cols = 'id, product_id, product_name, unit, old_cost, new_cost, old_price, new_price, changed_at, billed_at, changed_by'

  let tableMissing = false
  let pending: PriceLogRow[] = []
  let history: PriceLogRow[] = []
  try {
    pending = await fetchAll<PriceLogRow>((a, b) =>
      sb.from('product_price_log').select(cols).is('billed_at', null).order('changed_at', { ascending: false }).order('id').range(a, b))
    // Historial del último año y medio, para poder sacar informes por fechas
    const since = new Date(Date.now() - 540 * 86400000).toISOString()
    history = await fetchAll<PriceLogRow>((a, b) =>
      sb.from('product_price_log').select(cols).gte('changed_at', since).order('changed_at', { ascending: false }).order('id').range(a, b))
  } catch (e) {
    console.error('Registro de cambios de precio:', e)
    tableMissing = true
  }

  // Quién hizo cada cambio (nombre de la persona). Sin usuario = proceso automático (p. ej. «Aplicar al producto» de Costes).
  const names = new Map<string, string>()
  const userIds = [...new Set([...pending, ...history].map(r => r.changed_by).filter((v): v is string => !!v))]
  if (userIds.length > 0) {
    const { data: profs } = await (createAdminClient() as any).from('profiles').select('id, full_name').in('id', userIds)
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name || 'Usuario sin nombre')
  }

  const num = (v: unknown) => (v == null ? null : Number(v))
  const norm = (r: PriceLogRow): PriceLogRow => ({
    ...r, old_cost: num(r.old_cost), new_cost: num(r.new_cost), old_price: num(r.old_price), new_price: num(r.new_price),
    changed_by_name: r.changed_by ? (names.get(r.changed_by) ?? 'Usuario eliminado') : 'Proceso automático',
  })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <Link href="/admin/productos" className="text-sm text-gray-700 hover:text-black">← Volver a Productos</Link>
      <CambiosCosteClient pending={pending.map(norm)} history={history.map(norm)} tableMissing={tableMissing} />
    </div>
  )
}
