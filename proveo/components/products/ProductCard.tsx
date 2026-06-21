'use client'

import Image from 'next/image'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'
import { useState, useEffect } from 'react'

interface ProductCardProps {
  product: Product
  quantity: number
  onQuantityChange: (productId: string, quantity: number) => void
  categoryColor?: string | null
  categoryName?: string | null
}

const unitLabels: Record<string, string> = {
  kg: 'kg', g: 'g', l: 'l', ml: 'ml',
  unidad: 'ud', caja: 'caja', bandeja: 'bandeja',
}

function categoryEmoji(name?: string | null): string {
  if (!name) return '📦'
  const n = name.toLowerCase()
  if (n.includes('carne') || n.includes('ave')) return '🥩'
  if (n.includes('pescado') || n.includes('marisco')) return '🐟'
  if (n.includes('fruta')) return '🍊'
  if (n.includes('verdura') || n.includes('hortaliza')) return '🥦'
  if (n.includes('lácteo') || n.includes('lacteo') || n.includes('huevo')) return '🧀'
  if (n.includes('vino') || n.includes('bebida')) return '🍷'
  if (n.includes('seco') || n.includes('conserva')) return '🫙'
  if (n.includes('salsa') || n.includes('condimento')) return '🫒'
  if (n.includes('panadería') || n.includes('masa')) return '🥖'
  if (n.includes('utillaje') || n.includes('menaje')) return '🍴'
  if (n.includes('uniforme') || n.includes('ropa')) return '👕'
  if (n.includes('elaboracion') || n.includes('nave')) return '👨‍🍳'
  return '📦'
}

function placeholderStyle(color?: string | null): { background: string } {
  if (!color) return { background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }
  return { background: `linear-gradient(135deg, ${color}18, ${color}30)` }
}

export function ProductCard({
  product, quantity, onQuantityChange, categoryColor, categoryName,
}: ProductCardProps) {
  const hasQuantity = quantity > 0
  const increment = Number(product.order_increment) || 1
  const minQty = Number(product.min_order_quantity) || 1
  const unit = unitLabels[product.unit] ?? product.unit

  const [inputValue, setInputValue] = useState(quantity > 0 ? String(quantity) : '')

  // Sync input when quantity changes externally (e.g. removed from cart)
  useEffect(() => {
    setInputValue(quantity > 0 ? String(quantity) : '')
  }, [quantity])

  function increase() {
    const next = quantity === 0 ? minQty : quantity + increment
    const rounded = Math.round(next * 1000) / 1000
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
      const rounded = Math.round(num * 1000) / 1000
      onQuantityChange(product.id, rounded)
      setInputValue(String(rounded))
    }
  }

  return (
    <div className={cn(
      'relative bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-200 flex flex-col',
      hasQuantity
        ? 'border-[#F59E0B] shadow-[0_4px_20px_rgba(245,158,11,0.2)]'
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
              {categoryEmoji(categoryName)}
            </span>
            {categoryName && (
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-50"
                style={{ color: categoryColor ?? '#1B4332' }}>
                {categoryName}
              </span>
            )}
          </div>
        )}

        {hasQuantity && (
          <div className="absolute top-2 right-2 bg-[#F59E0B] text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
            {quantity} {unit}
          </div>
        )}
      </div>

      {/* ── Product info ─────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-[#1C1C1E] text-sm leading-tight line-clamp-2 flex-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>
        )}

        {/* ── Quantity selector ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={decrease}
            disabled={!hasQuantity}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95',
              hasQuantity
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
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
              onChange={e => setInputValue(e.target.value)}
              onBlur={e => commitInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { commitInput(inputValue); (e.target as HTMLInputElement).blur() } }}
              className={cn(
                'w-full text-center text-sm font-semibold tabular-nums bg-transparent border-0 outline-none focus:ring-1 focus:ring-gray-900 rounded-lg py-1',
                hasQuantity ? 'text-gray-900' : 'text-gray-400 placeholder-gray-300'
              )}
            />
            {hasQuantity && (
              <span className="text-[10px] text-gray-400 leading-none">{unit}</span>
            )}
          </div>

          <button
            onClick={increase}
            className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
