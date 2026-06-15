'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfileWithOrg } from '@/types/database'

export function useProfile() {
  const [profile, setProfile] = useState<ProfileWithOrg | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .single()

      setProfile(data as unknown as ProfileWithOrg)
      setLoading(false)
    }
    load()
  }, [])

  return { profile, loading }
}
