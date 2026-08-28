'use server'

import { cookies } from 'next/headers'

// Puerta de acceso propia de "Licinio informe" (aparte del PIN de la nave),
// con código fijo 1111 pedido explícitamente por el cliente — no depende de
// variables de entorno, a diferencia de INFORMES_ACCESS_CODE en informesGate.ts.
const CODE = '1111'
const COOKIE_NAME = 'licinio_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días

export async function unlockLicinio(code: string): Promise<{ ok: boolean; error?: string }> {
  if (code !== CODE) {
    return { ok: false, error: 'Código incorrecto' }
  }
  const store = await cookies()
  store.set(COOKIE_NAME, CODE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  return { ok: true }
}

export async function isLicinioUnlocked(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === CODE
}

export async function lockLicinio() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
