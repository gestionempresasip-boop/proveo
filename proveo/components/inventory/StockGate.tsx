'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockStock } from '@/app/actions/stockGate'

export function StockGate() {
  return (
    <CodeGate
      title="Stock"
      description="Introduce la clave de acceso para ver y modificar el stock de la nave."
      configured
      envName="STOCK_ACCESS_CODE"
      unlock={unlockStock}
    />
  )
}
