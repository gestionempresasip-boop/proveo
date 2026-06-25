'use client'

import { useState, useTransition } from 'react'
import { Users, Building2, Pencil, Check, X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { updateUserPin, updateUserProfile } from '@/app/actions/users'

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

type UserRow = {
  id: string; full_name: string | null; phone: string | null; role: string
  pin: string | null
  organizations: { name: string; type: string } | null
}

function PinCell({ user, onUpdated }: { user: UserRow; onUpdated: (id: string, patch: Partial<UserRow>) => void }) {
  const [editing, setEditing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    if (!/^\d{4}$/.test(value)) { setError('4 dígitos'); return }
    const newPin = value
    const prevPin = user.pin
    startTransition(async () => {
      onUpdated(user.id, { pin: newPin })
      setEditing(false)
      setValue('')
      try {
        await updateUserPin(user.id, newPin)
      } catch (e: any) {
        onUpdated(user.id, { pin: prevPin })
        setError(e.message ?? 'Error')
        setEditing(true)
        setValue(newPin)
      }
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text" inputMode="numeric" maxLength={4} autoFocus
          placeholder="••••"
          value={value}
          onChange={e => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
        <button onClick={save} disabled={pending} className="p-1 rounded text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
        <button onClick={() => { setEditing(false); setError(null) }} className="p-1 rounded text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-sm text-black tabular-nums">
        {user.pin ? (visible ? user.pin : '••••') : <span className="text-gray-700">Sin PIN</span>}
      </span>
      {user.pin && (
        <button onClick={() => setVisible(v => !v)} className="p-1 rounded text-gray-600 hover:text-[#1E2B28] hover:bg-gray-100">
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
      <button onClick={() => setEditing(true)} title="Cambiar PIN" className="p-1 rounded text-gray-600 hover:text-[#1E2B28] hover:bg-gray-100">
        <KeyRound className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function NameCell({ user, onUpdated }: { user: UserRow; onUpdated: (id: string, patch: Partial<UserRow>) => void }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const newName = String(fd.get('full_name') ?? '')
    const newPhone = String(fd.get('phone') ?? '')
    const prevName = user.full_name
    const prevPhone = user.phone
    setError(null)
    startTransition(async () => {
      onUpdated(user.id, { full_name: newName, phone: newPhone })
      setEditing(false)
      try {
        await updateUserProfile(user.id, fd)
      } catch (e: any) {
        onUpdated(user.id, { full_name: prevName, phone: prevPhone })
        setError(e.message ?? 'Error')
        setEditing(true)
      }
    })
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input name="full_name" defaultValue={user.full_name ?? ''} autoFocus placeholder="Nombre"
          className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
        <input name="phone" defaultValue={user.phone ?? ''} placeholder="Teléfono"
          className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
        <button type="submit" disabled={pending} className="p-1 rounded text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => setEditing(false)} className="p-1 rounded text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-[#1E2B28] text-white flex items-center justify-center text-xs font-bold shrink-0">
        {user.full_name?.[0] ?? '?'}
      </div>
      <span className="font-medium text-black">{user.full_name ?? 'Sin nombre'}</span>
      <button onClick={() => setEditing(true)} title="Editar" className="p-1 rounded text-gray-700 hover:text-[#1E2B28] hover:bg-gray-100">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

export function UsuariosTable({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers)

  function handleUpdated(id: string, patch: Partial<UserRow>) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Organización</th>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Rol</th>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">Teléfono</th>
              <th className="text-left px-4 py-3 text-gray-700 font-medium">PIN de acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><NameCell user={u} onUpdated={handleUpdated} /></td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-600" />
                    {u.organizations?.name ?? '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{u.phone ?? '—'}</td>
                <td className="px-4 py-3"><PinCell user={u} onUpdated={handleUpdated} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          No hay usuarios
        </div>
      )}
    </div>
  )
}
