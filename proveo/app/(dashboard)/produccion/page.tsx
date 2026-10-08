import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { getProductionState } from '@/app/actions/production'
import { ProduccionClient } from '@/components/production/ProduccionClient'

export default async function ProduccionPage() {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) redirect('/dashboard')
  const initial = await getProductionState()
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <ProduccionClient initial={initial} />
    </div>
  )
}
