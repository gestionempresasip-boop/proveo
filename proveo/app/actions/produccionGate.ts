'use server'

import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'
import { getAuthProfile } from '@/lib/supabase/helpers'

// Código de acceso a la pestaña Producción (las tablets del obrador). Es DISTINTO del
// código de Costes y Productos (sueldos y precios): el equipo de cocina conoce este y
// no el otro. Quien tiene el código de dirección también puede entrar. Solo lo comprueba
// el servidor: nunca llega al navegador.
const COOKIE_NAME = 'produccion_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días: se mete una vez por tablet

const secrets = () => ({
  prod: process.env.PRODUCCION_ACCESS_CODE?.trim() || null,
  admin: process.env.PRODUCTOS_ACCESS_CODE?.trim() || null,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
})

// La cookie depende del código de producción (o, si no hay, del de dirección):
// al cambiar el código, las tablets vuelven a pedirlo.
function expectedToken(): string | null {
  const { prod, admin, key } = secrets()
  const code = prod ?? admin
  if (!code || !key) return null
  return createHash('sha256').update(`produccion:${code}:${key}`).digest('hex')
}

const same = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

async function assertNaveUser() {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) throw new Error('Sin permisos')
}

export async function isProduccionCodeConfigured(): Promise<boolean> {
  return expectedToken() !== null
}

export async function isProduccionUnlocked(): Promise<boolean> {
  const token = expectedToken()
  if (!token) return false
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === token
}

export async function unlockProduccion(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveUser()
  const { prod, admin } = secrets()
  if (!prod && !admin) return { ok: false, error: 'Todavía no hay ningún código configurado (falta PRODUCCION_ACCESS_CODE)' }
  const given = code.trim()
  const ok = (prod !== null && same(given, prod)) || (admin !== null && same(given, admin))
  if (!ok) {
    await new Promise(r => setTimeout(r, 800)) // frena los intentos a lo loco
    return { ok: false, error: 'Código incorrecto' }
  }
  const token = expectedToken()
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  return { ok: true }
}

export async function lockProduccion() {
  await assertNaveUser()
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
