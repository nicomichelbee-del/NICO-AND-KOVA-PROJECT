import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BeekoWidget } from './BeekoWidget'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#07090f] flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        <Outlet />
      </main>
      <BeekoWidget />
    </div>
  )
}
