import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { adminDb, rowsOf } from '@/lib/serverAccess'
import { costesCodeStatus, isCostesUnlocked } from '@/app/actions/costesGate'
import { getMeasuredProducts, getRunHistory } from '@/app/actions/production'
import { loadCostContext, loadSoldPerMonth } from '@/lib/costContext'
import { CostesGate } from '@/components/costs/CostesGate'
import { CostesClient } from '@/components/costs/CostesClient'
import type { SavedSheet } from '@/components/costs/ui'

type ProductRow = {
  id: string; name: string; unit: string; price: number | string; cost_price: number | string
  margin: number | string | null; iva_rate: number | string | null; is_active: boolean | null
}

export default async function CostesPage() {
  const profile = await getAuthProfile()
  const allowed = (profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave'))
  if (!allowed) redirect('/dashboard')

  const [status, unlocked] = await Promise.all([costesCodeStatus(), isCostesUnlocked()])
  if (!unlocked) return <CostesGate configured={status.configured} problem={status.problem} />

  const db = adminDb()
  const orgId = profile.organization_id

  const [ctx, products, sheets, soldPerMonth, measured, history] = await Promise.all([
    loadCostContext(db, orgId),
    db.from('products').select('id, name, unit, price, cost_price, margin, iva_rate, is_active').is('deleted_at', null).order('name'),
    db.from('product_cost_sheets').select('*').eq('organization_id', orgId).order('name'),
    loadSoldPerMonth(db),
    getMeasuredProducts().catch(() => []),
    getRunHistory().catch(() => []),
  ])

  const sheetRows = rowsOf<SavedSheet>(sheets).map(s => ({
    ...s, yield_qty: Number(s.yield_qty), people: Number(s.people), minutes: Number(s.minutes), markup_pct: Number(s.markup_pct),
    ingredients: s.ingredients ?? [], extras: s.extras ?? [],
  }))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <CostesClient
        items={ctx.items}
        extraItems={ctx.extraItems}
        initialSettings={ctx.settings}
        settingsSaved={ctx.settingsSaved}
        products={rowsOf<ProductRow>(products).map(p => ({
          id: p.id, name: p.name, unit: p.unit, price: Number(p.price) || 0, is_active: p.is_active !== false,
          cost_price: Number(p.cost_price) || 0, margin: Number(p.margin) || 0, iva_rate: Number(p.iva_rate) || 0.1,
        }))}
        initialSheets={sheetRows}
        soldPerMonth={soldPerMonth}
        measured={measured}
        history={history}
        tableMissing={!!(sheets.error || products.error)}
      />
    </div>
  )
}
