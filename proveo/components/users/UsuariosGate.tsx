'use client'

import { CodeGate } from '@/components/CodeGate'
import { unlockUsuarios } from '@/app/actions/usuariosGate'

export function UsuariosGate({ configured }: { configured: boolean }) {
  return (
    <CodeGate
      title="Usuarios"
      description="Aquí se ven y se cambian los PIN de todos los locales. Introduce la clave de acceso."
      configured={configured}
      envName="USUARIOS_ACCESS_CODE"
      unlock={unlockUsuarios}
    />
  )
}
