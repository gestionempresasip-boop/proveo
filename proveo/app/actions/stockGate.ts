'use server'

import { getAuthProfile } from '@/lib/supabase/helpers'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Clave de acceso de STOCK de la nave (variable STOCK_ACCESS_CODE). Los restaurantes no la
// necesitan: ven su propio inventario como siempre.
const COOKIE_NAME = 'stock_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 horas

const configured = () => process.env.STOCK_ACCESS_CODE

async function assertNaveUser() {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') throw new Error('Sin permisos')
}

export async function isStockCodeConfigured(): Promise<boolean> {
  return gateToken('stock', configured()) !== null
}

export async function isStockUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('stock', configured()))
}

export async function unlockStock(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveUser()
  const real = configured()
  if (!real?.trim()) return { ok: false, error: 'Todavía no hay ninguna clave configurada (falta STOCK_ACCESS_CODE)' }
  if (!codesMatch(code, real)) {
    const hint = await rejectWrongCode('stock', { STOCK_ACCESS_CODE: real }, code)
    return { ok: false, error: 'Clave incorrecta' + hint }
  }
  const token = gateToken('stock', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function lockStock() {
  await assertNaveUser()
  await clearGateCookie(COOKIE_NAME)
}
