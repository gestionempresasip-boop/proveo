'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { canAccess } from '@/lib/areas'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Clave de acceso de STOCK de la nave. Propia (variable STOCK_ACCESS_CODE). Los restaurantes no la
// necesitan: ven su propio inventario como siempre. Mientras la variable no exista en el servidor,
// Stock se queda abierto como hasta ahora (así no se bloquea a nadie por un despliegue sin configurar).
const COOKIE_NAME = 'stock_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 horas

const configured = () => process.env.STOCK_ACCESS_CODE

async function assertNaveStock() {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave' || !canAccess(profile, 'stock')) throw new Error('Sin permisos')
}

/** ¿Hay que pedir la clave de Stock? Solo en la nave y solo si la variable está configurada. */
export async function stockNeedsCode(): Promise<boolean> {
  const profile = await getAuthProfile()
  return profile.organizations.type === 'nave' && !!configured()?.trim()
}

export async function isStockUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('stock', configured()))
}

export async function unlockStock(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveStock()
  const real = configured()
  if (!real?.trim()) return { ok: false, error: 'Todavía no hay ninguna clave configurada (falta STOCK_ACCESS_CODE)' }
  if (!codesMatch(code, real)) {
    await rejectWrongCode('stock', { STOCK_ACCESS_CODE: real })
    return { ok: false, error: 'Clave incorrecta' }
  }
  const token = gateToken('stock', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockStock() {
  await assertNaveStock()
  await clearGateCookie(COOKIE_NAME)
}
