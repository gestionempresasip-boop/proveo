import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { UsuariosTable } from '@/components/users/UsuariosTable'
import { NaveUsuarios } from '@/components/users/NaveUsuarios'
import { listNaveUsers } from '@/app/actions/naveAccess'
import { requireArea } from '@/lib/areaGuard'

export default async function AdminUsuariosPage() {
  await requireArea('usuarios')
  const profile = await getAuthProfile()
  const canManage = profile.role === 'admin' || profile.organizations.type === 'nave'
  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase as any)
    .from('profiles')
    .select('*, organizations(name, type)')
    .order('full_name')

  // Solo Dirección (acceso sin límite de pestañas) gestiona los usuarios de la nave.
  const isDireccion = profile.organizations.type === 'nave' && !profile.areas
  const naveUsers = isDireccion ? await listNaveUsers().catch(() => []) : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Usuarios</h1>
        <p className="text-gray-700 mt-1">{users?.length ?? 0} usuarios registrados · gestiona nombres y PINs de acceso</p>
      </div>

      {isDireccion && <NaveUsuarios initial={naveUsers} />}

      <UsuariosTable users={users ?? []} />
    </div>
  )
}
