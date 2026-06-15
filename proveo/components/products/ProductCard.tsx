'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'

interface ProductCardProps {
  product: Product
  quantity: number
  onQuantityChange: (productId: string, quantity: number) => void
}

const unitLabels: Record<string, string> = {
  kg: 'kg', g: 'g', l: 'l', ml: 'ml',
  unidad: 'ud', caja: 'caja', bandeja: 'bandeja'
}

export function ProductCard({ product, quantity, onQuantityChange }: ProductCardProps) {
  const hasQuantity = quantity > 0
  const increment = product.order_increment

  function increase() {
    const next = quantity === 0
      ? product.min_order_quantity
      : quantity + increment
    onQuantityChange(product.id, Math.round(next * 1000) / 1000)
  }

  function decrease() {
    if (quantity <= 0) return
    const next = quantity - increment
    onQuantityChange(product.id, next < product.min_order_quantity ? 0 : Math.round(next * 1000) / 1000)
  }

  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all',
        hasQuantity ? 'border-[#F59E0B] shadow-md' : 'border-transparent hover:border-gray-200'
      )}
    >
      {/* Imagen del producto */}
      <div className="relative aspect-square bg-gray-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d8f3dc] to-[#b7e4c7]">
            <span className="text-5xl">🍽️</span>
          </div>
        )}

        {/* Badge de cantidad seleccionada */}
        {hasQuantity && (
          <div className="absolute top-2 right-2 bg-[#F59E0B] text-white text-xs font-bold px-2 py-1 rounded-full">
            {quantity} {unitLabels[product.unit]}
          </div>
        )}
      </div>

      {/* Info del producto */}
      <div className="p-3">
        <h3 className="font-semibold text-[#1C1C1E] text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-[#1B4332] font-bold text-base">
              {Number(product.price).toFixed(2)}€
            </span>
            <span className="text-gray-400 text-xs ml-1">/ {unitLabels[product.unit]}</span>
          </div>
        </div>

        {/* Selector de cantidad */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={decrease}
            disabled={!hasQuantity}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              hasQuantity
                ? 'bg-[#1B4332] text-white hover:bg-[#163828]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            )}
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex-1 text-center">
            <span className={cn(
              'text-sm font-semibold',
              hasQuantity ? 'text-[#1B4332]' : 'text-gray-400'
            )}>
              {quantity > 0 ? `${quantity} ${unitLabels[product.unit]}` : '—'}
            </span>
          </div>

          <button
            onClick={increase}
            className="w-8 h-8 rounded-lg bg-[#1B4332] text-white flex items-center justify-center hover:bg-[#163828] transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
