import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
