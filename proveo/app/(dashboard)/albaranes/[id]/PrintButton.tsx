'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-[#1E2B28] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#141F1C] transition-colors"
    >
      <Printer className="w-4 h-4" />
      Imprimir / Guardar PDF
    </button>
  )
}
