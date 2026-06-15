import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      <Sidebar profile={profile} />
      {/* Offset on tablet for icon sidebar, on mobile for top bar */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 md:pl-16 lg:pl-0 min-w-0">
        {children}
      </main>
    </div>
  )
}
