import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import type { AthleteProfileRecord, ProfileMediaItem, ProfileVisibility } from '../types/profile'
import { useAuth } from './AuthContext'

// Stub ProfileContext — created to unblock the WIP refactor.
// Reads/writes a single profile record from localStorage so the dashboard
// renders without a Supabase profiles table. Swap to Supabase when ready.

interface ProfileContextType {
  profile: AthleteProfileRecord | null
  media: ProfileMediaItem[]
  loading: boolean
  saveDraft: (patch: Partial<AthleteProfileRecord>) => Promise<void>
}

const STORAGE_KEY = 'athleteProfileRecord'

function defaultProfile(): AthleteProfileRecord {
  return {
    full_name: null,
    graduation_year: null,
    primary_position: null,
    secondary_position: null,
    preferred_foot: null,
    current_club: null,
    current_league_or_division: null,
    high_school_name: null,
    gpa: null,
    sat_score: null,
    act_score: null,
    ncaa_eligibility_id: null,
    desired_division_levels: [],
    regions_of_interest: [],
    highlight_video_url: null,
    slug: null,
    profile_visibility: 'private' as ProfileVisibility,
    profile_strength_score: 0,
    profile_completed: false,
  }
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  media: [],
  loading: true,
  saveDraft: async () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<AthleteProfileRecord | null>(null)
  const [media] = useState<ProfileMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setProfile({ ...defaultProfile(), ...JSON.parse(raw) })
      } else {
        setProfile(defaultProfile())
      }
    } catch {
      setProfile(defaultProfile())
    }
    setLoading(false)
  }, [authLoading, user?.id])

  const saveDraft = useCallback(async (patch: Partial<AthleteProfileRecord>) => {
    setProfile((prev) => {
      const next = { ...(prev ?? defaultProfile()), ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, media, loading, saveDraft }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
