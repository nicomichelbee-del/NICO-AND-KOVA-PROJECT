import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export const TEST_MODE_KEY = 'TEST_MODE_USER'

const mockUser = {
  id: 'test-mode-user',
  email: 'test@kickriq.local',
  app_metadata: {},
  user_metadata: { full_name: 'Test Athlete' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as SupabaseUser

function isTestMode() {
  return import.meta.env.DEV && localStorage.getItem(TEST_MODE_KEY) === 'true'
}

interface AuthContextType {
  user: SupabaseUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isTestMode()) {
      setUser(mockUser)
      setLoading(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (isTestMode()) {
      localStorage.removeItem(TEST_MODE_KEY)
      localStorage.removeItem('athleteProfileRecord')
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
