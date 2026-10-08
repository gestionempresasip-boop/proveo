'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { deleteNaveUser, saveNaveUser, type NaveUser } from '@/app/actions/naveAccess'
import { AREA_LABEL, FULL_ACCESS_LABEL, TAB_AREAS, type Area } from '@/lib/areas'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

type Draft = { id?: string; name: string; pin: string; areas: Area[] }
const EMPTY: Draft = { name: '', pin: '', areas: [] }

const HINTS: Partial<Record<Area, string>> = {
  productos: 'precios, costes y márgenes de los productos',
  usuarios: 'ver y cambiar PIN de todos',
  costes: 'sueldos y costes de la nave (pide además su código)',
  informes: 'ventas y beneficio (pide además su código)',
}

// Usuarios de la nave con nombre y pestañas permitidas. Solo lo ve Dirección.
export function NaveUsuarios({ initial }: { initial: NaveUser[] }) {
  const [users, setUsers] = useState(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (a: Area) => setDraft(d => d && ({ ...d, areas: d.areas.includes(a) ? d.areas.filter(x => x !== a) : [...d.areas, a] }))

  async function save() {
    if (!draft) return
    setBusy(true); setMsg(null)
    try {
      const r = await saveNaveUser(draft)
      // recargar la lista tal cual está en el servidor es lo más fiable: se recarga la página
      setMsg({ ok: true, text: r.created ? 'Usuario creado.' : 'Cambios guardados.' })
      setDraft(null)
      window.location.reload()
    } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo guardar') }) }
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true); setMsg(null)
    try {
      const r = await deleteNaveUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      setConfirmDelete(null)
      setMsg({ ok: true, text: r.disabled ? 'Ya tenía actividad: no se puede borrar del todo, pero ha dejado de poder entrar.' : 'Usuario borrado.' })
    } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo borrar') }) }
    setBusy(false)
  }

  const field = 'w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:border-[#1E2B28]'

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <ShieldCheck className="w-6 h-6 text-[#A8793A] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[220px]">
          <h2 className="font-bold text-black">Usuarios de la nave y sus pestañas</h2>
          <p className="text-sm text-gray-600 mt-0.5">Crea un usuario con su nombre y su PIN, y marca qué pestañas del menú puede ver. Las demás ni aparecen. Tú ({FULL_ACCESS_LABEL}) ves todo.</p>
        </div>
        {!draft && (
          <button onClick={() => { setDraft({ ...EMPTY }); setMsg(null) }} className="flex items-center gap-1.5 rounded-xl bg-[#1E2B28] text-white font-semibold px-4 py-2.5 hover:bg-[#141F1C]">
            <Plus className="w-4 h-4" /> Nuevo usuario
          </button>
        )}
      </div>

      {draft && (
        <div className="rounded-xl border-2 border-[#1E2B28] p-4 space-y-4 bg-green-50/30">
          <p className="font-bold text-black">{draft.id ? 'Editar usuario' : 'Nuevo usuario'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-semibold text-gray-700 uppercase">Nombre</span>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ej: Laura" maxLength={40} className={cn(field, 'mt-1')} /></label>
            <label className="block"><span className="text-xs font-semibold text-gray-700 uppercase">{draft.id ? 'PIN nuevo (opcional)' : 'PIN (4 cifras)'}</span>
              <input inputMode="numeric" maxLength={4} value={draft.pin} onChange={e => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="0000" className={cn(field, 'mt-1 font-mono tracking-widest text-center')} /></label>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Pestañas que puede ver</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TAB_AREAS.map(a => (
                <label key={a} className={cn('flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 cursor-pointer', draft.areas.includes(a) ? 'border-[#1E2B28] bg-green-50' : 'border-gray-200 bg-white')}>
                  <input type="checkbox" checked={draft.areas.includes(a)} onChange={() => toggle(a)} className="w-4 h-4 mt-1 accent-[#1E2B28]" />
                  <span>
                    <span className="block font-semibold text-black text-sm">{AREA_LABEL[a]}</span>
                    {HINTS[a] && <span className="block text-[11px] text-gray-500">{HINTS[a]}</span>}
                  </span>
                </label>
              ))}
            </div>
            <label className={cn('flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 cursor-pointer mt-2', draft.areas.includes('precios') ? 'border-[#A8793A] bg-amber-50' : 'border-gray-200 bg-white')}>
              <input type="checkbox" checked={draft.areas.includes('precios')} onChange={() => toggle('precios')} className="w-4 h-4 mt-1 accent-[#A8793A]" />
              <span>
                <span className="block font-semibold text-black text-sm">Puede ver precios e importes</span>
                <span className="block text-[11px] text-gray-500">Si no lo marcas, en Pedidos y en los avisos no ve ningún importe (por ejemplo, el repartidor).</span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={busy || !draft.name.trim() || !draft.areas.some(a => a !== 'precios') || (!draft.id && draft.pin.length !== 4)} className="flex items-center gap-1.5 rounded-xl bg-[#1E2B28] text-white font-semibold px-5 py-3 disabled:opacity-50"><Check className="w-4 h-4" /> Guardar</button>
            <button onClick={() => { setDraft(null); setMsg(null) }} className="rounded-xl border border-gray-300 px-5 py-3 text-sm bg-white">Cancelar</button>
          </div>
        </div>
      )}

      {users.length === 0 && !draft ? (
        <p className="text-sm text-gray-600 rounded-xl bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-center">Todavía no hay usuarios con pestañas limitadas. Hoy todo el que entra por «Nave Obrador» ve todo.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {users.map(u => (
            <div key={u.id} className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-black">{u.name}</p>
                {u.areas.length === 0 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Desactivado</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {u.areas.map(a => <span key={a} className={cn('text-[11px] px-2 py-0.5 rounded-full', a === 'precios' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700')}>{AREA_LABEL[a]}</span>)}
                {u.areas.length > 0 && !u.areas.includes('precios') && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">Sin precios</span>}
              </div>
              {u.pin && (
                <p className="text-sm text-gray-700 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-gray-400" /> PIN: <span className="font-mono font-bold tracking-widest">{shown === u.id ? u.pin : '••••'}</span>
                  <button onClick={() => setShown(shown === u.id ? null : u.id)} className="text-gray-500" aria-label="Mostrar u ocultar PIN">{shown === u.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </p>
              )}
              {confirmDelete === u.id ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1 min-w-[160px] text-red-800">¿Borrar a {u.name}?</span>
                  <button disabled={busy} onClick={() => remove(u.id)} className="px-3 py-2 rounded-lg bg-red-600 text-white font-semibold">Sí, borrar</button>
                  <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 rounded-lg border border-gray-300">No</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setDraft({ id: u.id, name: u.name, pin: '', areas: u.areas }); setMsg(null) }} className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border-2 border-[#1E2B28] text-[#1E2B28] hover:bg-green-50"><Pencil className="w-4 h-4" /> Editar</button>
                  <button onClick={() => setConfirmDelete(u.id)} className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200"><Trash2 className="w-4 h-4" /> Borrar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && <p className={cn('text-sm rounded-xl px-3.5 py-2.5 flex items-center gap-2', msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>{!msg.ok && <X className="w-4 h-4 shrink-0" />}{msg.text}</p>}
      <p className="text-xs text-gray-600">Cuando todos tengan su usuario, <strong>cambia el PIN de {FULL_ACCESS_LABEL}</strong> (en la tabla de abajo): así nadie puede seguir entrando con el PIN antiguo y verlo todo.</p>
    </section>
  )
}
