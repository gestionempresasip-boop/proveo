'use client'

import Image from 'next/image'
import { ChefHat, RefreshCw, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ProfileWithOrg } from '@/types/database'
import { ORG_LOGOS } from '@/lib/orgLogos'

// Barra superior en móvil. A diferencia de la de abajo (fija), esta va en el
// flujo normal de la página para que se desplace al deslizar y deje ver bien
// el contenido. Solo se muestra en móvil (md:hidden); en escritorio manda la
// barra lateral.
export function MobileTopBar({ profile }: { profile: ProfileWithOrg }) {
  const router = useRouter()
  const supabase = createClient()
  const [refreshing, setRefreshing] = useState(false)

  const isNave = profile.organizations.type === 'nave'
  const orgLabel = isNave ? 'Nave Obrador' : profile.organizations.name
  const orgLogo = ORG_LOGOS[profile.organizations.name]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleRefresh() {
    setRefreshing(true)
    window.location.reload()
  }

  return (
    <header className="md:hidden bg-[#1E2B28] h-12 flex items-center justify-between px-4 border-b border-white/8 print:hidden">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden">
          {orgLogo ? (
            <div className="relative w-full h-full p-0.5">
              <Image src={orgLogo} alt={orgLabel} fill className="object-contain" />
            </div>
          ) : (
            <ChefHat className="h-3.5 w-3.5 text-gray-900" />
          )}
        </div>
        <span className="text-white font-bold text-sm tracking-tight">Proveo</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-600 text-xs">{orgLabel}</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-gray-700 hover:text-white transition-colors p-1 disabled:opacity-50"
          title="Actualizar datos"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
        <button
          onClick={handleLogout}
          className="text-gray-700 hover:text-red-400 transition-colors p-1"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
