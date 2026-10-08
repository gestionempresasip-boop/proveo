import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { redirect } from 'next/navigation'
import { PromocionesNaveManager } from '@/components/promotions/PromocionesNaveManager'

export default async function PromocionesPage() {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') redirect('/catalogo')

  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: promos }, { data: products }] = await Promise.all([
    sb
      .from('promotions')
      .select('*, products(id, name, unit)')
      .order('created_at', { ascending: false }),
    sb
      .from('products')
      .select('id, name, unit')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const promoProductIds = new Set((promos ?? []).map((p: any) => p.product_id))
  const availableProducts = (products ?? []).filter((p: any) => !promoProductIds.has(p.id))

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Promociones y sugerencias</h1>
        <p className="text-gray-600 text-sm mt-1">
          Los productos que añadas aquí aparecerán destacados al inicio del catálogo de los restaurantes.
          Ideal para comunicar caducidades próximas, ofertas del día o excedentes de stock.
        </p>
      </div>
      <PromocionesNaveManager
        promotions={promos ?? []}
        availableProducts={availableProducts}
      />
    </div>
  )
}
