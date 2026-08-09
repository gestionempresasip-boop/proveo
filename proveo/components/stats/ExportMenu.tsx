'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react'

// Menú desplegable de exportación (Excel / PDF / CSV) reutilizado en las
// tres pestañas de Informes. Excel y PDF se generan en el navegador
// (xlsx / jspdf), sin backend — por eso onExcel/onPDF son async y
// mostramos un pequeño estado de carga.
export function ExportMenu({
  onExcel, onPDF, onCSV,
}: {
  onExcel: () => void | Promise<void>
  onPDF: () => void | Promise<void>
  onCSV?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'excel' | 'pdf' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  async function handle(kind: 'excel' | 'pdf', fn: () => void | Promise<void>) {
    setLoading(kind)
    try {
      await fn()
    } finally {
      setLoading(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Exportar
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-20 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden min-w-[170px]">
          <button
            onClick={() => handle('excel', onExcel)}
            disabled={loading !== null}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-black hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />}
            Excel (.xlsx)
          </button>
          <button
            onClick={() => handle('pdf', onPDF)}
            disabled={loading !== null}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-black hover:bg-gray-50 disabled:opacity-50 border-t border-gray-50"
          >
            {loading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-red-600" />}
            PDF
          </button>
          {onCSV && (
            <button
              onClick={() => { onCSV(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-black hover:bg-gray-50 border-t border-gray-50"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" /> CSV
            </button>
          )}
        </div>
      )}
    </div>
  )
}
