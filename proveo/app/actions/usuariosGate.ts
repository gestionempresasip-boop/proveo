'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Clave de acceso de USUARIOS (variable USUARIOS_ACCESS_CODE). En esa pestaña se ven y se cambian
// los PIN de todos los locales, así que tiene su propia clave, distinta de las demás.
const COOKIE_NAME = 'usuarios_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 4 // 4 horas

const configured = () => process.env.USUARIOS_ACCESS_CODE

async function assertNaveUser() {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) throw new Error('Sin permisos')
}

export async function isUsuariosCodeConfigured(): Promise<boolean> {
  return gateToken('usuarios', configured()) !== null
}

export async function isUsuariosUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('usuarios', configured()))
}

export async function unlockUsuarios(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveUser()
  const real = configured()
  if (!real?.trim()) return { ok: false, error: 'Todavía no hay ninguna clave configurada (falta USUARIOS_ACCESS_CODE)' }
  if (!codesMatch(code, real)) {
    const hint = await rejectWrongCode('usuarios', { USUARIOS_ACCESS_CODE: real }, code)
    return { ok: false, error: 'Clave incorrecta' + hint }
  }
  const token = gateToken('usuarios', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockUsuarios() {
  await assertNaveUser()
  await clearGateCookie(COOKIE_NAME)
}
