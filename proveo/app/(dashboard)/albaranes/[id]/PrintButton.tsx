'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-[#1B4332] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163828] transition-colors"
    >
      <Printer className="w-4 h-4" />
      Imprimir / Guardar PDF
    </button>
  )
}
