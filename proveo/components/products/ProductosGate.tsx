'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockProducts } from '@/app/actions/productsGate'

export function ProductosGate({ configured }: { configured: boolean }) {
  return (
    <CodeGate
      title="Productos"
      description="Aquí están los precios, costes y márgenes. Introduce la clave de acceso."
      configured={configured}
      envName="PRODUCTOS_ACCESS_CODE"
      unlock={unlockProducts}
    />
  )
}
