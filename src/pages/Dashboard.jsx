import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function StatCard({ title, value, sub, color, icon }) {
  return (
    <div className={`bg-white rounded-2xl shadow p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    onboarding: 0,
    exited: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from('employees')
        .select('status')

      if (!error && data) {
        setStats({
          totalEmployees: data.length,
          activeEmployees: data.filter(e => e.status === 'active').length,
          onboarding: data.filter(e => e.status === 'onboarding').length,
          exited: data.filter(e => e.status === 'resigned' || e.status === 'terminated').length,
        })
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          sub="All time"
          color="border-blue-900"
          icon="👥"
        />
        <StatCard
          title="Active"
          value={stats.activeEmployees}
          sub="Currently deployed"
          color="border-green-500"
          icon="✅"
        />
        <StatCard
          title="Onboarding"
          value={stats.onboarding}
          sub="Pending completion"
          color="border-yellow-400"
          icon="📋"
        />
        <StatCard
          title="Exited"
          value={stats.exited}
          sub="Resigned / Terminated"
          color="border-red-400"
          icon="🚪"
        />
      </div>

      {/* Quick Info */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-gray-700 font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Add Employee',    icon: '➕', path: '/employees' },
            { label: 'Run Payroll',     icon: '💰', path: '/payroll' },
            { label: 'Bulk Onboard',    icon: '📥', path: '/onboarding' },
            { label: 'View Reports',    icon: '📈', path: '/reports' },
          ].map(action => (
            <button
              key={action.label}
              className="flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-4 transition"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-sm text-gray-600 font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard