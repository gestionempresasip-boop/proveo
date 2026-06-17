import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile} />
      {/* pt-12: clearance for top header on tablet/mobile. pb-[60px]: clearance for bottom tab bar */}
      <main className="flex-1 overflow-auto pt-12 pb-[60px] lg:pt-0 lg:pb-0 min-w-0">
        {children}
      </main>
    </div>
  )
}
