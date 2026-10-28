// Entrada propia de un cliente externo: solo aparece su local, no los demás.
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { LoginClient } from '@/components/auth/LoginClient'

export default async function ClientLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound()

  const admin = createAdminClient() as any
  const { data: org } = await admin
    .from('organizations')
    .select('name, login_slug')
    .eq('login_slug', slug)
    .eq('is_external', true)
    .maybeSingle()
  if (!org) notFound()

  return (
    <LoginClient
      clientSlug={org.login_slug}
      places={[{ name: org.name, email: `ext-${org.login_slug}@proveo.es`, type: 'restaurante' }]}
    />
  )
}
