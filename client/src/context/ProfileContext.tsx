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

const STORAGE_PREFIX = 'athleteProfileRecord:'
const LEGACY_STORAGE_KEY = 'athleteProfileRecord'

function storageKeyFor(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

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
    if (!user?.id) {
      setProfile(null)
      setLoading(false)
      return
    }
    const key = storageKeyFor(user.id)
    try {
      let raw = localStorage.getItem(key)
      // One-time migration: profiles used to be stored under a single global
      // key. Move it onto the current user so existing accounts on this
      // browser don't get sent back through onboarding.
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy) {
          localStorage.setItem(key, legacy)
          localStorage.removeItem(LEGACY_STORAGE_KEY)
          raw = legacy
        }
      }
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
    if (!user?.id) return
    const key = storageKeyFor(user.id)
    setProfile((prev) => {
      const next = { ...(prev ?? defaultProfile()), ...patch }
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [user?.id])

  return (
    <ProfileContext.Provider value={{ profile, media, loading, saveDraft }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
