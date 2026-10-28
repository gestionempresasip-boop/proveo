import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims verifica la firma y la caducidad del token en el propio servidor (sin viajar a Supabase en
  // cada clic, que era lo que más tardaba al cambiar de pestaña). Si el token ha caducado, lo renueva.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  const { pathname } = request.nextUrl

  // Si el usuario no está autenticado y trata de acceder a rutas protegidas
  // /cliente/<dirección>: entrada propia de un cliente externo (solo ve su local)
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/cliente/') && !pathname.startsWith('/auth') && !pathname.startsWith('/api/health')) {
    // Un dispositivo que entró como cliente externo vuelve a SU pantalla de entrada, no a la del grupo
    const clientSlug = request.cookies.get('proveo_client')?.value
    const target = clientSlug && /^[a-z0-9-]{3,40}$/.test(clientSlug) ? `/cliente/${clientSlug}` : '/login'
    return NextResponse.redirect(new URL(target, request.url))
  }

  // Si está autenticado y va a /login, redirigir al dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|sw.js|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
