'use server'

import { cookies } from 'next/headers'
import { createHash } from 'crypto'

// Segunda barrera de acceso a Informes (/estadisticas), aparte del PIN
// compartido de la nave. Como el PIN de la nave lo conoce cualquiera que
// trabaje ahí, esto añade un código propio, distinto, que solo comprueba
// el servidor — nunca llega al navegador ni al código fuente.
const COOKIE_NAME = 'informes_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días

function expectedToken(): string | null {
  const code = process.env.INFORMES_ACCESS_CODE
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY // ya existe, no hay que añadir otra variable solo para esto
  if (!code || !secret) return null
  return createHash('sha256').update(`${code}:${secret}`).digest('hex')
}

export async function unlockInformes(code: string): Promise<{ ok: boolean; error?: string }> {
  const realCode = process.env.INFORMES_ACCESS_CODE
  if (!realCode) {
    return { ok: false, error: 'No hay ningún código configurado todavía (falta INFORMES_ACCESS_CODE)' }
  }
  if (code !== realCode) {
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

export async function isInformesUnlocked(): Promise<boolean> {
  const token = expectedToken()
  if (!token) return false
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === token
}

export async function lockInformes() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
