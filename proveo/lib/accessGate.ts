import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { describeConfigured, normalizeCode } from '@/lib/accessCode'

// Piezas comunes de las pantallas de código de acceso (cookie de «ya desbloqueado», retardo ante
// un código incorrecto y registro de diagnóstico). Cada pantalla tiene su propia cookie y su
// propio código, así que desbloquear una no abre las demás.

/** Valor de la cookie de desbloqueo: depende del código (limpio) y de la clave del servidor. Cambiar el código la invalida. */
export function gateToken(prefix: string, code: string | null | undefined): string | null {
  const clean = normalizeCode(code)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clean || !key) return null
  return createHash('sha256').update(`${prefix}:${clean}:${key}`).digest('hex')
}

export async function hasGateCookie(name: string, token: string | null): Promise<boolean> {
  if (!token) return false
  return (await cookies()).get(name)?.value === token
}

export async function setGateCookie(name: string, token: string, maxAgeSeconds: number) {
  ;(await cookies()).set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export async function clearGateCookie(name: string) {
  ;(await cookies()).delete(name)
}

/** Frena los intentos a lo loco tras un código incorrecto, y deja en los registros del servidor si la variable está configurada. */
export async function rejectWrongCode(gate: string, vars: Record<string, string | null | undefined>) {
  console.warn(`[acceso:${gate}] código incorrecto. ` + Object.entries(vars).map(([k, v]) => `${k}: ${describeConfigured(v)}`).join(' · '))
  await new Promise(r => setTimeout(r, 800))
}
