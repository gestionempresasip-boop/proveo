'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { canAccess } from '@/lib/areas'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Código de acceso a la pestaña Producción (las tablets del obrador). Es DISTINTO del código de
// Costes y del de Productos (sueldos y precios): el equipo de cocina conoce este y no los otros.
// Quien tiene el código de Productos también puede entrar. Solo lo comprueba el servidor.
const COOKIE_NAME = 'produccion_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días: se mete una vez por tablet

const prodCode = () => process.env.PRODUCCION_ACCESS_CODE
const adminCode = () => process.env.PRODUCTOS_ACCESS_CODE

// La cookie depende del código de producción (o, si no hay, del de dirección):
// al cambiar el código, las tablets vuelven a pedirlo.
const currentToken = () => gateToken('produccion', prodCode() || adminCode())

async function assertNaveUser() {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave') || !canAccess(profile, 'produccion')) throw new Error('Sin permisos')
}

export async function isProduccionCodeConfigured(): Promise<boolean> {
  return currentToken() !== null
}

export async function isProduccionUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, currentToken())
}

export async function unlockProduccion(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveUser()
  if (!prodCode() && !adminCode()) return { ok: false, error: 'Todavía no hay ningún código configurado (falta PRODUCCION_ACCESS_CODE)' }
  if (!(codesMatch(code, prodCode()) || codesMatch(code, adminCode()))) {
    await rejectWrongCode('produccion', { PRODUCCION_ACCESS_CODE: prodCode(), PRODUCTOS_ACCESS_CODE: adminCode() })
    // Si la variable del obrador no está en el servidor, lo normal es que no se haya guardado
    // en Render (nombre mal escrito o despliegue sin terminar): se avisa en vez de solo «incorrecto».
    return {
      ok: false,
      error: prodCode() ? 'Código incorrecto' : 'Código incorrecto. El servidor no tiene configurada la variable PRODUCCION_ACCESS_CODE: revisa en Render que el nombre esté escrito igual y que el despliegue haya terminado.',
    }
  }
  const token = currentToken()
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockProduccion() {
  await assertNaveUser()
  await clearGateCookie(COOKIE_NAME)
}
