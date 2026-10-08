'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockProducts } from '@/app/actions/productsGate'

// Los costes reales llevan sueldos y estructura de la nave: se piden con el mismo
// código que las categorías protegidas de Productos.
export function CostesGate({ configured }: { configured: boolean }) {
  return (
    <CodeGate
      title="Costes reales"
      description="Esta sección incluye sueldos y costes de la nave. Introduce el código de acceso."
      configured={configured}
      envName="PRODUCTOS_ACCESS_CODE"
      unlock={unlockProducts}
    />
  )
}
