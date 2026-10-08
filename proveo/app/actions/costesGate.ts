'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { canAccess } from '@/lib/areas'
import { alphanumericProblem, codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Clave de acceso de COSTES (sueldos y estructura de la nave). Es propia, distinta de la de Productos,
// y tiene que ser ALFANUMÉRICA (letras y números). Se configura en la variable COSTES_ACCESS_CODE.
// Si el valor configurado no es alfanumérico, no se acepta ningún código hasta corregirlo.
const COOKIE_NAME = 'costes_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 8 // 8 horas

const configured = () => process.env.COSTES_ACCESS_CODE

async function assertCostesUser() {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok || !canAccess(profile, 'costes')) throw new Error('Sin permisos')
}

/** Estado de la clave: si existe y, si no vale, por qué. */
export async function costesCodeStatus(): Promise<{ configured: boolean; problem: string | null }> {
  const code = configured()
  const problem = alphanumericProblem(code)
  return { configured: !!code && !problem, problem: code && problem ? `El código configurado en el servidor ${problem}.` : null }
}

export async function isCostesUnlocked(): Promise<boolean> {
  if (alphanumericProblem(configured())) return false
  return hasGateCookie(COOKIE_NAME, gateToken('costes', configured()))
}

export async function unlockCostes(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertCostesUser()
  const real = configured()
  if (!real) return { ok: false, error: 'Todavía no hay ninguna clave configurada (falta COSTES_ACCESS_CODE)' }
  const problem = alphanumericProblem(real)
  if (problem) return { ok: false, error: `La clave configurada en el servidor ${problem}. Cámbiala en Render (COSTES_ACCESS_CODE).` }
  if (!codesMatch(code, real)) {
    await rejectWrongCode('costes', { COSTES_ACCESS_CODE: real })
    return { ok: false, error: 'Clave incorrecta' }
  }
  const token = gateToken('costes', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockCostes() {
  await assertCostesUser()
  await clearGateCookie(COOKIE_NAME)
}
