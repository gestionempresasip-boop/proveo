// Icono de la app de un cliente externo: su inicial sobre los colores de Proveo.
import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
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

  const url = new URL(req.url)
  const requested = Number(url.searchParams.get('s'))
  const size = [180, 192, 512].includes(requested) ? requested : 512
  // Maskable: el sistema recorta los bordes, así que la letra va más pequeña y el fondo llena todo.
  const maskable = url.searchParams.get('m') === '1'
  const initial = (String(org.name).trim()[0] ?? 'P').toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1E2B28', color: '#E0A84A', fontWeight: 700,
          fontSize: size * (maskable ? 0.5 : 0.62),
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        {initial}
      </div>
    ),
    { width: size, height: size },
  )
}
