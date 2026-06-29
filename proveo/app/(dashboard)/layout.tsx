import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white">
      <Sidebar profile={profile} />
      {/* pt-12: clearance for top header on phone. pb-[60px]: clearance for bottom tab bar */}
      <main className="flex-1 overflow-auto pt-12 pb-[60px] md:pt-0 md:pb-0 min-w-0 print:p-0 print:overflow-visible">
        {children}
      </main>
    </div>
  )
}
