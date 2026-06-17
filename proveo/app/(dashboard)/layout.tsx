import { getAuthProfile } from '@/lib/supabase/helpers'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthProfile()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-auto pt-13 lg:pt-0 min-w-0">
        {children}
      </main>
    </div>
  )
}
