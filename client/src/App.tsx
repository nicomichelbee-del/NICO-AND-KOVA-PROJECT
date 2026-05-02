import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import { Chat } from './pages/dashboard/Chat'
import { Timeline } from './pages/dashboard/Timeline'
import { AuthCallback } from './pages/AuthCallback'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const testMode = localStorage.getItem('testMode') === 'true'
  if (loading) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-[#eab308] text-sm font-medium">Loading...</div>
    </div>
  )
  return (user || testMode) ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
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
            <Route path="chat" element={<Chat />} />
            <Route path="timeline" element={<Timeline />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
