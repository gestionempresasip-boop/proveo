'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { softDeleteProduct } from '@/app/actions/products'

export function DeleteProductoButton({ productId, productName }: { productId: string; productName: string }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">¿Eliminar?</span>
        <button
          onClick={async () => {
            setDeleting(true)
            await softDeleteProduct(productId)
          }}
          disabled={deleting}
          className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Sí'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-gray-400 hover:underline"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title={`Eliminar ${productName}`}
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
