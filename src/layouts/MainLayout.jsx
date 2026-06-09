import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const menuItems = [
  { path: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { path: '/employees',   label: 'Employees',   icon: '👥' },
  { path: '/onboarding',  label: 'Onboarding',  icon: '📋' },
  { path: '/salary', label: 'Salary', icon: '💵' },
  { path: '/payroll',     label: 'Payroll',      icon: '💰' },
  { path: '/compliance',  label: 'Compliance',   icon: '📁' },
  { path: '/payslips',    label: 'Payslips',     icon: '🧾' },
  { path: '/accounting',  label: 'Accounting',   icon: '📒' },
  { path: '/reports',     label: 'Reports',      icon: '📈' },
  { path: '/settings',    label: 'Settings',     icon: '⚙️' },
]

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar */}
      <div className={`${collapsed ? 'w-16' : 'w-64'} bg-blue-900 text-white flex flex-col transition-all duration-300`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-blue-800">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold">PeopleOne</h1>
              <p className="text-blue-300 text-xs">Staffing & Payroll</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-blue-300 hover:text-white text-xl ml-auto"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4">
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-800 transition
                ${location.pathname === item.path ? 'bg-blue-700 font-semibold border-r-4 border-yellow-400' : ''}
              `}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-blue-800 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-2 py-2 text-sm text-blue-300 hover:text-white hover:bg-blue-800 rounded transition"
          >
            <span>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <h2 className="text-gray-700 font-semibold text-lg capitalize">
            {location.pathname.replace('/', '')}
          </h2>
          <div className="text-sm text-gray-500">
            PeopleOne Admin
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>

      </div>
    </div>
  )
}

export default MainLayout