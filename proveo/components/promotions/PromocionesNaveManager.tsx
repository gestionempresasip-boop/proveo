'use client'

import { useState } from 'react'
import { Tag, Trash2, Plus, Loader2, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertPromotion, removePromotion } from '@/app/actions/promotions'

type SimpleProduct = { id: string; name: string; unit: string }
type PromoRow = {
  id: string
  product_id: string
  label: string
  notes: string | null
  expires_at: string | null
  created_at: string
  products: SimpleProduct | null
}

const LABEL_SUGGESTIONS = [
  'Caduca hoy',
  'Caduca pronto',
  'Últimas unidades',
  'Sugerencia del día',
  'Producto del día',
  'Oferta especial',
  'Perecedero',
  'Excedente de stock',
]

export function PromocionesNaveManager({
  promotions: initialPromos,
  availableProducts,
}: {
  promotions: PromoRow[]
  availableProducts: SimpleProduct[]
}) {
  const [promos, setPromos] = useState<PromoRow[]>(initialPromos)
  const [available, setAvailable] = useState<SimpleProduct[]>(availableProducts)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [productId, setProductId] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  async function handleAdd() {
    if (!productId || !label.trim()) return
    setSaving(true)
    setError(null)
    try {
      await upsertPromotion(productId, label.trim(), notes || null, expiresAt || null)
      const product = available.find(p => p.id === productId)!
      const newPromo: PromoRow = {
        id: crypto.randomUUID(),
        product_id: productId,
        label: label.trim(),
        notes: notes || null,
        expires_at: expiresAt || null,
        created_at: new Date().toISOString(),
        products: product,
      }
      setPromos(prev => [newPromo, ...prev])
      setAvailable(prev => prev.filter(p => p.id !== productId))
      setProductId('')
      setLabel('')
      setNotes('')
      setExpiresAt('')
    } catch {
      setError('Error al guardar la promoción. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id)
    try {
      await removePromotion(id)
      const removed = promos.find(p => p.id === id)
      setPromos(prev => prev.filter(p => p.id !== id))
      if (removed?.products) {
        setAvailable(prev =>
          [...prev, removed.products!].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        )
      }
    } catch {
      setError('Error al eliminar la promoción.')
    } finally {
      setRemoving(null)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* ── Formulario añadir ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-black text-base mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#A8793A]" />
          Añadir producto a promoción
        </h2>

        {available.length === 0 ? (
          <p className="text-sm text-gray-600">
            {promos.length > 0
              ? 'Todos los productos activos ya tienen una promoción asignada.'
              : 'No hay productos activos disponibles.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Producto *</label>
              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E2B28] bg-white"
              >
                <option value="">Selecciona un producto...</option>
                {available.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Etiqueta *</label>
              <input
                list="label-suggestions"
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Ej: Caduca hoy, Sugerencia del día..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
              <datalist id="label-suggestions">
                {LABEL_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Descripción (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ej: Aprovéchalo antes de que caduque, descuento especial..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Válido hasta (opcional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                min={today}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sin fecha: la promoción queda activa hasta que la elimines tú.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleAdd}
              disabled={!productId || !label.trim() || saving}
              className="w-full bg-[#A8793A] hover:bg-[#8C6430] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</>
                : 'Añadir a promociones'}
            </button>
          </div>
        )}
      </div>

      {/* ── Lista activas ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold text-black text-base mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-600" />
          Activas ahora
          {promos.length > 0 && (
            <span className="ml-1 text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
              {promos.length}
            </span>
          )}
        </h2>

        {promos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Sin promociones activas</p>
            <p className="text-sm text-gray-500 mt-1">
              Añade un producto arriba para que aparezca destacado en el catálogo de los restaurantes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {promos.map(promo => (
              <div
                key={promo.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-black text-sm">{promo.products?.name ?? '—'}</span>
                    <span className={cn(
                      'text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                      'bg-amber-100 text-amber-800'
                    )}>
                      {promo.label}
                    </span>
                  </div>
                  {promo.notes && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{promo.notes}</p>
                  )}
                  {promo.expires_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Válido hasta:{' '}
                      {new Date(promo.expires_at + 'T12:00:00').toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'long',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(promo.id)}
                  disabled={removing === promo.id}
                  title="Quitar de promociones"
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  {removing === promo.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
