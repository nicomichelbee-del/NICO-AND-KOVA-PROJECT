import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { AuthCallback } from './pages/AuthCallback'
import { OnboardingProfile } from './pages/onboarding/OnboardingProfile'
import { PublicProfile } from './pages/PublicProfile'

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
  const testMode = localStorage.getItem('testMode') === 'true'
  if (loading) return <LoadingScreen />
  return (user || testMode) ? <>{children}</> : <Navigate to="/login" replace />
}

// Gates everything dashboard-side: redirects to /onboarding/profile until the
// athlete has filled out the required fields. Onboarding itself is rendered
// outside this guard so users can always reach it.
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  const testMode = localStorage.getItem('testMode') === 'true'
  if (loading) return <LoadingScreen />
  if (testMode) return <>{children}</>
  if (!profile?.profile_completed) return <Navigate to="/onboarding/profile" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/players/:slug" element={<PublicProfile />} />

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
            </Route>
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  )
}
