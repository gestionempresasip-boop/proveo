// Entrada propia de un cliente externo: solo aparece su local, no los demás.
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { LoginClient } from '@/components/auth/LoginClient'

type Params = { params: Promise<{ slug: string }> }

// Cada cliente se instala como su propia app (manifiesto e icono propios), distinta de Proveo.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return {}
  const admin = createAdminClient() as any
  const { data: org } = await admin.from('organizations').select('name').eq('login_slug', slug).eq('is_external', true).maybeSingle()
  if (!org) return {}
  return {
    title: org.name,
    manifest: `/cliente/${slug}/manifest.webmanifest`,
    icons: { icon: `/cliente/${slug}/icon?s=192`, apple: `/cliente/${slug}/icon?s=180` },
    appleWebApp: { capable: true, title: org.name },
  }
}

export default async function ClientLoginPage({ params }: Params) {
  const { slug } = await params
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound()

  const admin = createAdminClient() as any
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, login_slug')
    .eq('login_slug', slug)
    .eq('is_external', true)
    .maybeSingle()
  if (!org) notFound()

  // Al abrir la app instalada con la sesión ya iniciada, va directo a su catálogo.
  // Solo si la sesión es de ESTE cliente: quien abre el enlace con otra cuenta (la nave, por ejemplo) ve la entrada.
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub
  if (uid) {
    const { data: prof } = await admin.from('profiles').select('organization_id').eq('id', uid).maybeSingle()
    if (prof?.organization_id === org.id) redirect('/catalogo')
  }

  return (
    <LoginClient
      clientSlug={org.login_slug}
      places={[{ name: org.name, email: `ext-${org.login_slug}@proveo.es`, type: 'restaurante' }]}
    />
  )
}
