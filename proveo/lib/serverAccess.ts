import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { isCostesUnlocked } from '@/app/actions/costesGate'
import { isProduccionUnlocked } from '@/app/actions/produccionGate'
import { canAccess } from '@/lib/areas'

// Comprobaciones de acceso compartidas por las server actions de Costes y Producción.
// Las tablas nuevas no tienen RLS con políticas: todo pasa por aquí, con la service
// role, DESPUÉS de comprobar quién llama.

export type OrgContext = { orgId: string }

/** Cliente de servicio sin tipos de tablas (las tablas nuevas no están en los tipos generados). */
export const adminDb = (): SupabaseClient => createAdminClient() as unknown as SupabaseClient

/** Cualquier usuario de la nave (las tablets del obrador) o admin. */
export async function assertNave(): Promise<OrgContext> {
  const profile = await getAuthProfile()
  if (!(profile.role === 'admin' || profile.organizations.type === 'nave')) throw new Error('Sin permisos')
  return { orgId: profile.organization_id }
}

/** Tablets del obrador: usuario de la nave con el código de Producción ya introducido. */
export async function assertProduccion(): Promise<OrgContext> {
  const ctx = await assertNave()
  if (!canAccess(await getAuthProfile(), 'produccion')) throw new Error('No tienes acceso a Producción')
  if (!(await isProduccionUnlocked())) throw new Error('Introduce primero el código de Producción')
  return ctx
}

/** Encargado de la nave o admin, con la clave de Costes ya introducida (sueldos y costes). */
export async function assertCostAccess(): Promise<OrgContext> {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok || !canAccess(profile, 'costes')) throw new Error('Sin permisos')
  if (!(await isCostesUnlocked())) throw new Error('Introduce primero la clave de Costes')
  return { orgId: profile.organization_id }
}

/** Filas de una respuesta de Supabase sin tipar, con el tipo que tú le das. */
export const rowsOf = <T>(res: { data: unknown }): T[] => (res.data ?? []) as T[]
