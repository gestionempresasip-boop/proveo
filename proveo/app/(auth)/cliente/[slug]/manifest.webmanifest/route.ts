// Manifiesto propio de cada cliente externo: así se puede instalar como una app distinta de Proveo
// (identificador, nombre, icono e inicio propios) y conviven en el mismo dispositivo.
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return new Response('Not found', { status: 404 })

  const admin = createAdminClient() as any
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('login_slug', slug)
    .eq('is_external', true)
    .maybeSingle()
  if (!org) return new Response('Not found', { status: 404 })

  const manifest = {
    id: `/cliente/${slug}`,
    name: org.name,
    short_name: String(org.name).slice(0, 12),
    description: `Pedidos a la nave de ${org.name}`,
    start_url: `/cliente/${slug}`,
    scope: '/',
    display: 'standalone',
    background_color: '#FAFAF8',
    theme_color: '#1E2B28',
    icons: [
      { src: `/cliente/${slug}/icon?s=192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/cliente/${slug}/icon?s=512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/cliente/${slug}/icon?s=512&m=1`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' },
  })
}
