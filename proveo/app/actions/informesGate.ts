'use server'

import { assertArea } from '@/lib/areaGuard'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Segunda barrera de acceso a Informes (/estadisticas), aparte del PIN
// compartido de la nave. Como el PIN de la nave lo conoce cualquiera que
// trabaje ahí, esto añade un código propio, distinto, que solo comprueba
// el servidor — nunca llega al navegador ni al código fuente.
const COOKIE_NAME = 'informes_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días

const configured = () => process.env.INFORMES_ACCESS_CODE

export async function unlockInformes(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertArea('informes')
  const real = configured()
  if (!real) {
    return { ok: false, error: 'No hay ningún código configurado todavía (falta INFORMES_ACCESS_CODE)' }
  }
  if (!codesMatch(code, real)) {
    await rejectWrongCode('informes', { INFORMES_ACCESS_CODE: real })
    return { ok: false, error: 'Código incorrecto' }
  }

  const token = gateToken('informes', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  return { ok: true }
}

export async function isInformesUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('informes', configured()))
}

export async function lockInformes() {
  await clearGateCookie(COOKIE_NAME)
}
