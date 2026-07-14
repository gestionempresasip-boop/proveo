import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTopBar } from '@/components/layout/MobileTopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  // El scroll es el del documento (natural en móvil). Solo la barra inferior
  // (en Sidebar) es fija; la superior (MobileTopBar) va dentro de <main> para
  // que se desplace al deslizar. pb-[60px] deja hueco para la barra inferior.
  return (
    <div className="flex min-h-dvh bg-gray-50 print:bg-white">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0 pb-[60px] md:pb-0 print:pb-0">
        <MobileTopBar profile={profile} />
        {children}
      </main>
    </div>
  )
}
