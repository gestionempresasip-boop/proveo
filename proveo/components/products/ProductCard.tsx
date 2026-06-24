'use client'

import Image from 'next/image'
import { Plus, Minus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'
import { useState, useEffect } from 'react'
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
}

function placeholderStyle(color?: string | null): { background: string } {
  if (!color) return { background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }
  return { background: `linear-gradient(135deg, ${color}18, ${color}30)` }
}

export function ProductCard({
  product, quantity, onQuantityChange, categoryColor, categoryName, maxStock, justRestocked,
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
      {/* ── Image area ──────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] w-full shrink-0">
        {(product as any).image_url ? (
          <Image
            src={(product as any).image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1 select-none"
            style={placeholderStyle(categoryColor)}
          >
            <span className="text-4xl sm:text-5xl leading-none">
              {productEmoji(product.name, categoryName)}
            </span>
            {categoryName && (
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-50"
                style={{ color: categoryColor ?? '#1E2B28' }}>
                {categoryName}
              </span>
            )}
          </div>
        )}

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

      {/* ── Product info ─────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-black text-sm leading-tight line-clamp-2 flex-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{product.description}</p>
        )}
        {!outOfStock && maxStock !== undefined && (
          <p className="text-[10px] text-gray-600 mt-0.5">Quedan {maxStock} {unit}</p>
        )}

        {/* ── Quantity selector ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={decrease}
            disabled={!hasQuantity}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95',
              hasQuantity
                ? 'bg-[#1E2B28] text-white'
                : 'bg-gray-100 text-gray-700 cursor-not-allowed'
            )}
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex-1 flex flex-col items-center">
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
                'w-full text-center text-sm font-semibold tabular-nums bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#1E2B28] rounded-lg py-1',
                hasQuantity ? 'text-gray-900' : 'text-gray-600 placeholder-gray-500'
              )}
            />
            {hasQuantity && (
              <span className="text-[10px] text-gray-600 leading-none">{unit}</span>
            )}
          </div>

          <button
            onClick={increase}
            disabled={outOfStock || atStockLimit}
            title={atStockLimit ? 'Has llegado al stock disponible' : undefined}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0',
              outOfStock || atStockLimit ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : 'bg-[#1E2B28] text-white'
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
