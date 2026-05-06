import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Leaderboard } from './pages/Leaderboard'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Overview } from './pages/dashboard/Overview'
import { Profile } from './pages/dashboard/Profile'
import { Schools } from './pages/dashboard/Schools'
import { Emails } from './pages/dashboard/Emails'
import { Tracker } from './pages/dashboard/Tracker'
import { FollowUp } from './pages/dashboard/FollowUp'
import { VideoRater } from './pages/dashboard/VideoRater'
import { Camps } from './pages/dashboard/Camps'
import { RosterIntel } from './pages/dashboard/RosterIntel'
import { Timeline } from './pages/dashboard/Timeline'
import { Eligibility } from './pages/dashboard/Eligibility'
import { ForCoaches } from './pages/ForCoaches'
import { CoachDashboard } from './pages/CoachDashboard'
import { AuthCallback } from './pages/AuthCallback'
import { OnboardingProfile } from './pages/onboarding/OnboardingProfile'
import { PublicProfile } from './pages/PublicProfile'
import { OpenSpots } from './pages/OpenSpots'
import { About } from './pages/About'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
import { AgeVerify } from './pages/AgeVerify'

function LoadingScreen() {
  return (
    <div className="kr-app flex items-center justify-center">
      <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-gold animate-pulse">
        Loading…
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  // COPPA / parental-consent gate. Anyone whose user_metadata is missing
  // birth_year (existing accounts before the gate shipped, or any Google
  // OAuth account) goes through /age-verify before reaching the dashboard.
  // Test-mode users bypass this — they have no Supabase metadata.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const isTestUser = user.id === 'test-mode-user'
  if (!isTestUser && typeof meta.birth_year !== 'number') {
    return <Navigate to="/age-verify" replace />
  }
  return <>{children}</>
}

// Gates everything dashboard-side: redirects to /onboarding/profile until the
// athlete has filled out the required fields. Onboarding itself is rendered
// outside this guard so users can always reach it.
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  if (loading) return <LoadingScreen />
  if (!profile?.profile_completed) return <Navigate to="/onboarding/profile" replace />
  // Backfill: pre-existing users completed onboarding before gender was a
  // required field. Bounce them through edit mode so matching/emails/roster
  // intel stop defaulting to "mens".
  if (!profile.gender) return <Navigate to="/onboarding/profile?edit=1" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Analytics />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/age-verify" element={<AgeVerify />} />
            <Route path="/players/:slug" element={<PublicProfile />} />
            <Route path="/open-spots" element={<OpenSpots />} />
            <Route path="/open-spots/:gender" element={<OpenSpots />} />
            <Route path="/open-spots/:gender/:position" element={<OpenSpots />} />
            <Route path="/for-coaches" element={<ForCoaches />} />
            <Route path="/for-coaches/dashboard" element={<CoachDashboard />} />

            <Route
              path="/onboarding/profile"
              element={
                <ProtectedRoute>
                  <OnboardingProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RequireCompleteProfile>
                    <DashboardLayout />
                  </RequireCompleteProfile>
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="profile" element={<Profile />} />
              <Route path="schools" element={<Schools />} />
              <Route path="emails" element={<Emails />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="followup" element={<FollowUp />} />
              <Route path="video" element={<VideoRater />} />
              <Route path="camps" element={<Camps />} />
              <Route path="roster" element={<RosterIntel />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="eligibility" element={<Eligibility />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  )
}
