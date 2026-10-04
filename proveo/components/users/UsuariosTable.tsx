'use client'

import { useState, useTransition } from 'react'
import { Users, Building2, Pencil, Check, X, KeyRound, Eye, EyeOff, Phone } from 'lucide-react'
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

const btn = 'flex items-center justify-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors'

function PinBlock({ user, onUpdated }: { user: UserRow; onUpdated: (id: string, patch: Partial<UserRow>) => void }) {
  const [editing, setEditing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    if (!/^\d{4}$/.test(value)) { setError('El PIN tiene que ser de 4 dígitos'); return }
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

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1.5">PIN de acceso</p>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text" inputMode="numeric" maxLength={4} autoFocus
            placeholder="Nuevo PIN"
            value={value}
            onChange={e => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            className="w-28 border border-gray-300 rounded-xl px-3 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
          />
          <button onClick={save} disabled={pending} className={`${btn} bg-[#1E2B28] border-[#1E2B28] text-white hover:bg-[#141F1C] disabled:opacity-50`}>
            <Check className="w-4 h-4" /> Guardar
          </button>
          <button onClick={() => { setEditing(false); setError(null) }} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl tracking-widest text-black tabular-nums min-w-[72px]">
            {user.pin ? (visible ? user.pin : '••••') : <span className="text-sm tracking-normal font-sans text-gray-600">Sin PIN</span>}
          </span>
          {user.pin && (
            <button onClick={() => setVisible(v => !v)} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {visible ? 'Ocultar' : 'Ver PIN'}
            </button>
          )}
          <button onClick={() => setEditing(true)} className={`${btn} border-[#A8793A] text-[#A8793A] hover:bg-amber-50`}>
            <KeyRound className="w-4 h-4" /> Cambiar PIN
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}

function UserCard({ user, onUpdated }: { user: UserRow; onUpdated: (id: string, patch: Partial<UserRow>) => void }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const initial = (user.full_name || user.organizations?.name || '?').trim()[0]?.toUpperCase() ?? '?'

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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[#1E2B28] text-white flex items-center justify-center text-lg font-bold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Nombre</label>
                <input name="full_name" defaultValue={user.full_name ?? ''} autoFocus placeholder="Nombre"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Teléfono</label>
                <input name="phone" defaultValue={user.phone ?? ''} placeholder="Teléfono"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className={`${btn} bg-[#1E2B28] border-[#1E2B28] text-white hover:bg-[#141F1C] disabled:opacity-50`}>
                  <Check className="w-4 h-4" /> Guardar
                </button>
                <button type="button" onClick={() => setEditing(false)} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-black text-base leading-tight">{user.full_name ?? 'Sin nombre'}</p>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-gray-700 mt-1.5">
                <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                {user.organizations?.name ?? '—'}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-700 mt-1">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                {user.phone ?? '—'}
              </p>
              <button onClick={() => setEditing(true)} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50 mt-3`}>
                <Pencil className="w-4 h-4" /> Editar nombre y teléfono
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <PinBlock user={user} onUpdated={onUpdated} />
      </div>
    </div>
  )
}

export function UsuariosTable({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers)

  function handleUpdated(id: string, patch: Partial<UserRow>) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
        No hay usuarios
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {users.map(u => (
        <UserCard key={u.id} user={u} onUpdated={handleUpdated} />
      ))}
    </div>
  )
}
