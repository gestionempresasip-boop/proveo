'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockProduccion } from '@/app/actions/produccionGate'

export function ProduccionGate({ configured }: { configured: boolean }) {
  return (
    <CodeGate
      title="Producción"
      description="Introduce el código del obrador. Solo hace falta una vez en cada tablet."
      configured={configured}
      envName="PRODUCCION_ACCESS_CODE"
      unlock={unlockProduccion}
    />
  )
}
