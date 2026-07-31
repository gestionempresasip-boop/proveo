'use client'

import { Plus, Minus, Star, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'
import { useState, useEffect, memo } from 'react'
import { unitLabel } from '@/lib/units'

interface ProductRowProps {
  product: Product
  quantity: number
  onQuantityChange: (productId: string, quantity: number) => void
  categoryColor?: string | null
  categoryName?: string | null
  maxStock?: number
  justRestocked?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (productId: string, next: boolean) => void
  boxMode?: 'unidad' | 'cajon'
  onBoxModeChange?: (productId: string, mode: 'unidad' | 'cajon') => void
}

export const ProductRow = memo(function ProductRow({
  product, quantity, onQuantityChange, categoryColor, categoryName, maxStock, justRestocked,
  isFavorite, onToggleFavorite, boxMode, onBoxModeChange,
}: ProductRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState(quantity > 0 ? String(quantity) : '')

  const allowsBox = (product as any).allows_box_order as boolean | undefined
  const boxUnits  = (product as any).box_units as number | null | undefined
  const isBoxMode = allowsBox && boxMode === 'cajon'

  const hasQuantity = quantity > 0
  const increment = isBoxMode ? 1 : (Number(product.order_increment) || 1)
  const minQty    = isBoxMode ? 1 : (Number(product.min_order_quantity) || 1)
  const unit      = isBoxMode ? 'cajón' : unitLabel(product.unit)
  const outOfStock   = maxStock !== undefined && maxStock <= 0
  const atStockLimit = maxStock !== undefined && quantity >= maxStock

  useEffect(() => {
    setInputValue(quantity > 0 ? String(quantity) : '')
  }, [quantity])

  // Auto-expand when a quantity is added externally (e.g. repeat order)
  useEffect(() => {
    if (quantity > 0) setExpanded(true)
  }, [quantity > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  function clamp(value: number) {
    return maxStock !== undefined ? Math.min(value, maxStock) : value
  }

  function increase() {
    if (outOfStock || atStockLimit) return
    if (!expanded) setExpanded(true)
    const next = quantity === 0 ? minQty : quantity + increment
    onQuantityChange(product.id, clamp(Math.round(next * 1000) / 1000))
  }

  function decrease() {
    if (quantity <= 0) return
    const next = quantity - increment
    onQuantityChange(product.id, next < minQty ? 0 : Math.round(next * 1000) / 1000)
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

  function handleRowClick() {
    if (outOfStock) return
    setExpanded(v => !v)
  }

  return (
    <div className={cn(
      'border-b border-gray-100 last:border-0 transition-colors',
      hasQuantity ? 'bg-amber-50/60' : 'bg-white'
    )}>
      {/* ── Collapsed row ──────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleRowClick() }}
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none"
      >
        {/* Category color dot */}
        {categoryColor
          ? <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: categoryColor }} />
          : <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-gray-200" />
        }

        {/* Name + stock */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-semibold leading-tight truncate',
            outOfStock ? 'text-gray-400' : 'text-gray-900'
          )}>
            {product.name}
            {justRestocked && !outOfStock && (
              <Sparkles className="inline-block ml-1 w-3 h-3 text-green-500" />
            )}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {outOfStock
              ? <span className="text-red-500 font-medium">Sin stock</span>
              : maxStock !== undefined
                ? <>Quedan {maxStock} {unit}{isBoxMode && boxUnits ? ` (≈${maxStock * boxUnits} und)` : ''}</>
                : unit
            }
          </p>
        </div>

        {/* Right: quantity badge OR expand chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasQuantity && (
            <span className="text-xs font-bold bg-[#A8793A] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
              {isBoxMode ? `${quantity} caj.` : `${quantity} ${unit}`}
            </span>
          )}
          {!outOfStock && !expanded && !hasQuantity && (
            <button
              onClick={e => { e.stopPropagation(); increase() }}
              className="w-7 h-7 rounded-lg bg-[#1E2B28] text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn(
            'h-4 w-4 text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </div>
      </div>

      {/* ── Expanded panel ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Description + category label */}
          {(product.description || categoryName) && (
            <div className="pl-5">
              {categoryName && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                  {categoryName}
                </p>
              )}
              {product.description && (
                <p className="text-xs text-gray-600 leading-relaxed">{product.description}</p>
              )}
            </div>
          )}

          {/* Cajón / Unidad toggle */}
          {allowsBox && onBoxModeChange && (
            <div className="pl-5">
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => { onBoxModeChange(product.id, 'unidad'); onQuantityChange(product.id, 0) }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    !isBoxMode ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  )}
                >
                  Por unidad
                </button>
                <button
                  onClick={() => { onBoxModeChange(product.id, 'cajon'); onQuantityChange(product.id, 0) }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    isBoxMode ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  )}
                >
                  Cajón{boxUnits ? ` ≈${boxUnits} und` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Quantity stepper */}
          <div className="pl-5 flex items-center gap-2">
            <button
              onClick={decrease}
              disabled={!hasQuantity}
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0',
                hasQuantity ? 'bg-[#1E2B28] text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex-1 flex flex-col items-center min-w-0">
              <input
                type="number"
                inputMode={isBoxMode ? 'numeric' : 'decimal'}
                min="0"
                step={isBoxMode ? '1' : undefined}
                value={inputValue}
                placeholder="—"
                disabled={outOfStock}
                onChange={e => setInputValue(e.target.value)}
                onBlur={e => commitInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { commitInput(inputValue); (e.target as HTMLInputElement).blur() } }}
                className="w-full text-center text-sm font-semibold tabular-nums bg-gray-50 border border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-[#1E2B28] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {hasQuantity && (
                <span className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">
                  {unit}{isBoxMode && boxUnits ? ` ≈${quantity * boxUnits} und` : ''}
                </span>
              )}
            </div>

            <button
              onClick={increase}
              disabled={outOfStock || atStockLimit}
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0',
                outOfStock || atStockLimit ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#1E2B28] text-white'
              )}
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Favorite star (inside expanded, keeps collapsed row clean) */}
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(product.id, !isFavorite)}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                  isFavorite ? 'text-amber-400 bg-amber-50' : 'text-gray-300 hover:text-amber-400 bg-gray-50'
                )}
              >
                <Star className={cn('w-4 h-4', isFavorite && 'fill-current')} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
