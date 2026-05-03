import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BeekoWidget } from './BeekoWidget'

export function DashboardLayout() {
  return (
    <div className="kr-app">
      <Sidebar />
      <div className="ml-64 min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <BeekoWidget />
    </div>
  )
}
