'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBackup, listBackups, deleteBackup, restoreBackup } from '@/app/actions/backups'
import { Shield, RotateCcw, Trash2, Check, X, ShieldAlert } from 'lucide-react'

type Backup = {
  id: string
  label: string
  products_count: number
  categories_count: number
  created_at: string
}

function RestoreButton({ backup, onRestored }: { backup: Backup; onRestored: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      try {
        await restoreBackup(backup.id)
        setConfirming(false)
        onRestored()
      } catch {
        setError('No se pudo restaurar, inténtalo de nuevo')
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-red-600 font-medium whitespace-nowrap">¿Restaurar a este punto?</span>
        <button disabled={pending} onClick={handleRestore} className="p-1 rounded text-red-600 hover:bg-red-50">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-600 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs font-medium border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Restaurar
    </button>
  )
}

function DeleteBackupButton({ backup, onDeleted }: { backup: Backup; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-700 whitespace-nowrap">¿Eliminar copia?</span>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await deleteBackup(backup.id); onDeleted() })}
          className="p-1 rounded text-red-600 hover:bg-red-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setConfirming(false)} className="p-1 rounded text-gray-600 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} title="Eliminar copia" className="p-1.5 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-50 transition-colors">
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

export function BackupsPanel() {
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [label, setLabel] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [restoredMsg, setRestoredMsg] = useState(false)
  const router = useRouter()

  function loadBackups() {
    startTransition(async () => {
      const data = await listBackups()
      setBackups(data as Backup[])
    })
  }

  useEffect(() => { loadBackups() }, [])

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      try {
        await createBackup(label)
        setLabel('')
        loadBackups()
      } catch {
        setError('No se pudo crear la copia de seguridad, inténtalo de nuevo')
      }
    })
  }

  function handleRestored() {
    setRestoredMsg(true)
    router.refresh()
    setTimeout(() => setRestoredMsg(false), 4000)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-medium text-black">Nueva copia de seguridad</p>
        <p className="text-xs text-gray-600">
          Guarda productos, categorías y stock (nave y restaurantes) tal como están ahora. Si algo se rompe más adelante, podrás restaurar a este punto.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Nombre (opcional, ej: Antes de la temporada de verano)"
            className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
          />
          <button
            onClick={handleCreate}
            disabled={pending}
            className="flex items-center gap-1.5 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] disabled:opacity-60 transition-colors"
          >
            <Shield className="w-4 h-4" />
            {pending ? 'Guardando...' : 'Crear copia de seguridad ahora'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {restoredMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5">
          <Check className="w-4 h-4 shrink-0" /> Copia restaurada correctamente
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#1E2B28]" />
          <span className="font-semibold text-sm text-black">Copias guardadas</span>
        </div>
        {backups === null ? (
          <p className="text-center py-10 text-gray-600 text-sm">Cargando...</p>
        ) : backups.length === 0 ? (
          <p className="text-center py-10 text-gray-600 text-sm">Todavía no has creado ninguna copia de seguridad</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">Copia</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">Fecha</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-600 font-medium">Productos</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-600 font-medium">Categorías</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {backups.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-black">{b.label}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(b.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{b.products_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{b.categories_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <RestoreButton backup={b} onRestored={handleRestored} />
                      <DeleteBackupButton backup={b} onDeleted={loadBackups} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
