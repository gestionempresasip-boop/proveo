'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockStock } from '@/app/actions/stockGate'

export function StockGate({ configured }: { configured: boolean }) {
  return (
    <CodeGate
      title="Stock"
      description="Introduce la clave de acceso para ver y modificar el stock de la nave."
      configured={configured}
      envName="STOCK_ACCESS_CODE"
      unlock={unlockStock}
    />
  )
}
