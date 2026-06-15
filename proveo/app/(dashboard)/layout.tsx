import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      <Sidebar profile={profile} />
      {/* Mobile/tablet: only offset for top bar (pt-14). Desktop: no top bar. */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 min-w-0">
        {children}
      </main>
    </div>
  )
}
