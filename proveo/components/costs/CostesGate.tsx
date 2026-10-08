'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockCostes } from '@/app/actions/costesGate'

// Costes lleva sueldos y estructura de la nave: tiene su propia clave, alfanumérica.
export function CostesGate({ configured, problem }: { configured: boolean; problem?: string | null }) {
  return (
    <CodeGate
      title="Costes reales"
      description="Esta sección incluye sueldos y costes de la nave. Introduce la clave de acceso."
      configured={configured}
      problem={problem}
      envName="COSTES_ACCESS_CODE"
      unlock={unlockCostes}
    />
  )
}
