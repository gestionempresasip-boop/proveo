// Server Component: aquí `dynamic` sí tiene efecto (Next.js ignora esta
// directiva en archivos 'use client'). Sin esto, la página se pre-renderiza
// como estática y queda cacheada en el borde durante mucho tiempo — tras
// cada despliegue, los navegadores con esa caché piden JS/CSS de la build
// anterior, que ya no existe, y la página se ve sin estilos.
export const dynamic = 'force-dynamic'

import { LoginClient } from '@/components/auth/LoginClient'

export default function LoginPage() {
  return <LoginClient />
}
