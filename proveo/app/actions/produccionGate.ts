'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Clave de acceso de la pestaña PRODUCCIÓN (las tablets del obrador), variable PRODUCCION_ACCESS_CODE.
// Es propia y distinta de las demás: el equipo de cocina conoce esta y no las de Costes o Productos.
// Solo la comprueba el servidor.
const COOKIE_NAME = 'produccion_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días: se mete una vez por tablet

const configured = () => process.env.PRODUCCION_ACCESS_CODE

async function assertNaveUser() {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) throw new Error('Sin permisos')
}

export async function isProduccionCodeConfigured(): Promise<boolean> {
  return gateToken('produccion', configured()) !== null
}

export async function isProduccionUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('produccion', configured()))
}

export async function unlockProduccion(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveUser()
  const real = configured()
  if (!real?.trim()) {
    return { ok: false, error: 'El servidor no tiene configurada la variable PRODUCCION_ACCESS_CODE: revisa en Render que el nombre esté escrito igual y que el despliegue haya terminado.' }
  }
  if (!codesMatch(code, real)) {
    const hint = await rejectWrongCode('produccion', { PRODUCCION_ACCESS_CODE: real }, code)
    return { ok: false, error: 'Código incorrecto' + hint }
  }
  const token = gateToken('produccion', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockProduccion() {
  await assertNaveUser()
  await clearGateCookie(COOKIE_NAME)
}
