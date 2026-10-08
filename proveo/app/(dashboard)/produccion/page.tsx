import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { getProductionState } from '@/app/actions/production'
import { isProduccionCodeConfigured, isProduccionUnlocked } from '@/app/actions/produccionGate'
import { ProduccionClient } from '@/components/production/ProduccionClient'
import { ProduccionGate } from '@/components/production/ProduccionGate'
import { requireArea } from '@/lib/areaGuard'

export default async function ProduccionPage() {
  await requireArea('produccion')
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) redirect('/dashboard')

  // Sin el código del obrador no se piden ni los productos ni los trabajadores.
  if (!(await isProduccionUnlocked())) return <ProduccionGate configured={await isProduccionCodeConfigured()} />

  const initial = await getProductionState()
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <ProduccionClient initial={initial} />
    </div>
  )
}
