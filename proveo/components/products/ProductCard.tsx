'use client'

import { Plus, Minus, Sparkles, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'
import { useState, useEffect, memo } from 'react'
import { unitLabel } from '@/lib/units'
import { productEmoji } from '@/lib/productEmoji'

interface ProductCardProps {
  product: Product
  quantity: number
  onQuantityChange: (productId: string, quantity: number) => void
  categoryColor?: string | null
  categoryName?: string | null
  /** undefined = sin límite de stock controlado por la nave */
  maxStock?: number
  justRestocked?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (productId: string, next: boolean) => void
}

function placeholderStyle(color?: string | null): { background: string } {
  if (!color) return { background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }
  return { background: `linear-gradient(135deg, ${color}18, ${color}30)` }
}

export const ProductCard = memo(function ProductCard({
  product, quantity, onQuantityChange, categoryColor, categoryName, maxStock, justRestocked,
  isFavorite, onToggleFavorite,
}: ProductCardProps) {
  const hasQuantity = quantity > 0
  const increment = Number(product.order_increment) || 1
  const minQty = Number(product.min_order_quantity) || 1
  const unit = unitLabel(product.unit)
  const outOfStock = maxStock !== undefined && maxStock <= 0
  const atStockLimit = maxStock !== undefined && quantity >= maxStock

  const [inputValue, setInputValue] = useState(quantity > 0 ? String(quantity) : '')

  // Sync input when quantity changes externally (e.g. removed from cart)
  useEffect(() => {
    setInputValue(quantity > 0 ? String(quantity) : '')
  }, [quantity])

  function clamp(value: number) {
    return maxStock !== undefined ? Math.min(value, maxStock) : value
  }

  function increase() {
    const next = quantity === 0 ? minQty : quantity + increment
    const rounded = clamp(Math.round(next * 1000) / 1000)
    onQuantityChange(product.id, rounded)
  }

  function decrease() {
    if (quantity <= 0) return
    const next = quantity - increment
    const rounded = next < minQty ? 0 : Math.round(next * 1000) / 1000
    onQuantityChange(product.id, rounded)
  }

  function commitInput(value: string) {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      onQuantityChange(product.id, 0)
      setInputValue('')
    } else {
      const rounded = clamp(Math.round(num * 1000) / 1000)
      onQuantityChange(product.id, rounded)
      setInputValue(String(rounded))
    }
  }

  return (
    <div className={cn(
      'relative bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-200 flex flex-col',
      hasQuantity
        ? 'border-[#A8793A] shadow-[0_4px_20px_rgba(245,158,11,0.2)]'
        : 'border-transparent hover:border-gray-200 hover:shadow-md'
    )}>
      {/* ── Name header (reemplaza la imagen) ──────────────────────── */}
      <div
        className="relative px-3 pt-3 pb-2 shrink-0 overflow-hidden"
        style={placeholderStyle(categoryColor)}
      >
        {/* Emoji decorativo de fondo */}
        <span className="absolute bottom-1 right-2 text-4xl opacity-10 select-none pointer-events-none leading-none">
          {productEmoji(product.name, categoryName)}
        </span>

        {categoryName && (
          <span
            className="text-[10px] font-semibold uppercase tracking-widest opacity-50 block mb-1"
            style={{ color: categoryColor ?? '#1E2B28' }}
          >
            {categoryName}
          </span>
        )}

        <div className="flex items-start gap-1.5">
          <h3 className="font-bold text-gray-900 text-sm leading-snug flex-1">
            {product.name}
          </h3>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(product.id, !isFavorite)}
              title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              className={cn('shrink-0 p-0.5 -mt-0.5 -mr-0.5', isFavorite ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400')}
            >
              <Star className={cn('w-4 h-4', isFavorite && 'fill-current')} />
            </button>
          )}
        </div>

        {hasQuantity && (
          <div className="absolute top-2 right-2 bg-[#A8793A] text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
            {quantity} {unit}
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Sin stock</span>
          </div>
        )}
        {!outOfStock && justRestocked && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
            <Sparkles className="h-3 w-3" />Disponible de nuevo
          </div>
        )}
      </div>

      {/* ── Descripción e info ───────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1">
        {product.description && (
          <p className="text-xs text-gray-600 mb-1 line-clamp-2">{product.description}</p>
        )}
        {!outOfStock && maxStock !== undefined && (
          <p className="text-[10px] text-gray-600 mb-1">Quedan {maxStock} {unit}</p>
        )}

        {/* ── Quantity selector ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={decrease}
            disabled={!hasQuantity}
            className={cn(
              'w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95',
              hasQuantity
                ? 'bg-[#1E2B28] text-white'
                : 'bg-gray-100 text-gray-700 cursor-not-allowed'
            )}
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0 flex flex-col items-center">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={inputValue}
              placeholder="—"
              disabled={outOfStock}
              onChange={e => setInputValue(e.target.value)}
              onBlur={e => commitInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { commitInput(inputValue); (e.target as HTMLInputElement).blur() } }}
              className={cn(
                'w-full min-w-0 text-center text-sm font-semibold tabular-nums bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#1E2B28] rounded-lg py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                hasQuantity ? 'text-gray-900' : 'text-gray-600 placeholder-gray-500'
              )}
            />
            {hasQuantity && (
              <span className="text-[10px] text-gray-600 leading-none whitespace-nowrap">{unit}</span>
            )}
          </div>

          <button
            onClick={increase}
            disabled={outOfStock || atStockLimit}
            title={atStockLimit ? 'Has llegado al stock disponible' : undefined}
            className={cn(
              'w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0',
              outOfStock || atStockLimit ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : 'bg-[#1E2B28] text-white'
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
})
