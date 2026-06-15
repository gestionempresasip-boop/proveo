import { getAuthProfile } from '@/lib/supabase/helpers'
import { createClient } from '@/lib/supabase/server'
import { Users, Building2 } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  nave_manager: 'Gestor Nave',
  restaurante_manager: 'Responsable',
  restaurante_staff: 'Personal',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  nave_manager: 'bg-blue-100 text-blue-700',
  restaurante_manager: 'bg-amber-100 text-amber-700',
  restaurante_staff: 'bg-gray-100 text-gray-600',
}

export default async function AdminUsuariosPage() {
  const profile = await getAuthProfile()
  if (profile.role !== 'admin') {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Usuarios</h1>
          <p className="text-gray-500 mt-1">{users?.length ?? 0} usuarios registrados</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Organización</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Rol</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Teléfono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#1C1C1E]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {u.full_name?.[0] ?? '?'}
                    </div>
                    {u.full_name ?? 'Sin nombre'}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {u.organizations?.name ?? '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!users || users.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No hay usuarios
          </div>
        )}
      </div>
    </div>
  )
}
