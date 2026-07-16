import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── Full nav definition ───────────────────────────────────────
// tag: 'india' = only India/Both, 'us' = only US/Both, undefined = always show
const NAV = [
  {
    section: null,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    section: 'People',
    tag: 'india',
    items: [
      { path: '/employees',  label: 'Employees',     icon: '👥' },
      { path: '/onboarding', label: 'Onboarding',    icon: '🚀' },
      { path: '/attendance', label: 'Attendance',    icon: '📅' },
      { path: '/flexi',      label: 'Flexi Workers', icon: '👷' },
    ],
  },
  {
    section: 'Clients & Contracts',
    items: [
      { path: '/clients',     label: 'Clients',          icon: '🏢' },
      { path: '/contracts',   label: 'Contracts',        icon: '📄' },
      { path: '/work-orders', label: 'Work Orders / PO', icon: '📋' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { path: '/deployments', label: 'Deployments',  icon: '🗂️',  tag: 'india' },
      { path: '/rpo',         label: 'RPO Pipeline', icon: '🎯',  tag: 'india' },
      { path: '/us',          label: 'US Staffing',  icon: '🌐',  tag: 'us', alert: 'us' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { path: '/payroll',       label: 'Payroll',       icon: '💰', tag: 'india' },
      { path: '/billing-recon', label: 'Billing Recon', icon: '🔄', tag: 'india' },
      { path: '/invoicing',     label: 'Invoicing',     icon: '🧾' },
      { path: '/compliance',    label: 'Compliance',    icon: '📑' },
    ],
  },
  {
    section: null,
    items: [
      { path: '/revenue-leakage', label: 'Revenue Leakage', icon: '🔴', alert: 'leakage' },
      { path: '/settings',        label: 'Settings',        icon: '⚙️' },
    ],
  },
]

// ─── Which paths are visible per mode ─────────────────────────
function isVisible(item, section, mode) {
  const itemTag    = item.tag
  const sectionTag = section?.tag
  const tag = itemTag ?? sectionTag  // item-level overrides section-level
  if (!tag) return true
  if (tag === 'india') return mode === 'india_only' || mode === 'both'
  if (tag === 'us')    return mode === 'us_only'    || mode === 'both'
  return true
}

// ─── Layout ───────────────────────────────────────────────────
export default function Layout({ children }) {
  const [collapsed, setCollapsed]   = useState(false)
  const [leakageCount, setLeakage]  = useState(0)
  const [visaCount, setVisa]        = useState(0)
  const [tsCount, setTs]            = useState(0)
  const [mode, setMode]             = useState('india_only')
  const [companyName, setCompanyName] = useState('PeopleOne')
  const [fxRate, setFxRate]         = useState(null)
  const location  = useLocation()
  const navigate  = useNavigate()

  useEffect(() => {
    fetchCompanySettings()
    fetchAlerts()
    // Listen for settings updates
    window.addEventListener('company-settings-updated', fetchCompanySettings)
    return () => window.removeEventListener('company-settings-updated', fetchCompanySettings)
  }, [])

  async function fetchCompanySettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('operating_mode, company_name, usd_inr_fallback')
      .limit(1)
      .single()
    if (data) {
      setMode(data.operating_mode || 'india_only')
      setCompanyName(data.company_name || 'PeopleOne')
    }
    // Fetch live FX rate if US mode
    if (data?.operating_mode === 'us_only' || data?.operating_mode === 'both') {
      fetchFxRate(data?.usd_inr_fallback)
    }
  }

  async function fetchFxRate(fallback = 84) {
    try {
      const res  = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR')
      const json = await res.json()
      setFxRate(json.rates?.INR ?? fallback)
    } catch {
      setFxRate(fallback)
    }
  }

  async function fetchAlerts() {
    const [{ data: leak }, { data: visa }, { data: ts }] = await Promise.all([
      supabase.from('revenue_leakage_alerts').select('reference_id', { count: 'exact', head: true }),
      supabase.from('us_consultants').select('id').in('status', ['active', 'placed', 'bench'])
        .lte('visa_expiry', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]),
      supabase.from('us_timesheets').select('id', { count: 'exact', head: true })
        .eq('status', 'approved').eq('invoice_raised', false),
    ])
    setLeakage(leak?.length || 0)
    setVisa(visa?.length   || 0)
    setTs(ts?.length       || 0)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const alerts = { leakageCount, visaCount, tsCount }
  const modeLabel = { india_only: '🇮🇳 India', us_only: '🇺🇸 US', both: '🌐 Global' }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-gray-900 flex flex-col transition-all duration-200 flex-shrink-0`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
              <div>
                <span className="text-white font-bold text-sm tracking-tight">{companyName}</span>
                <p className="text-gray-500 text-xs">{modeLabel[mode]}</p>
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded">
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* FX Rate badge (US/Both mode) */}
        {!collapsed && fxRate && (mode === 'us_only' || mode === 'both') && (
          <div className="mx-3 mt-2 bg-blue-900/50 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <span className="text-blue-300 text-xs">USD/INR</span>
            <span className="text-blue-100 text-xs font-bold">₹{fxRate.toFixed(2)}</span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
          {NAV.map((group, gi) => {
            // Filter items by mode
            const visibleItems = group.items.filter(item => isVisible(item, group, mode))
            if (visibleItems.length === 0) return null

            return (
              <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                {group.section && !collapsed && (
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group.section}
                  </p>
                )}
                {group.section && collapsed && (
                  <div className="mx-2 my-2 border-t border-gray-700" />
                )}
                {visibleItems.map(item => {
                  const badge = getBadge(item.alert, alerts)
                  return (
                    <NavItem
                      key={item.path}
                      item={item}
                      collapsed={collapsed}
                      badge={badge}
                      active={location.pathname === item.path}
                    />
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Alert strip */}
        {!collapsed && (leakageCount > 0 || visaCount > 0 || tsCount > 0) && (
          <div className="mx-3 mb-3 bg-gray-800 rounded-xl p-3 space-y-1">
            {leakageCount > 0 && (
              <button onClick={() => navigate('/revenue-leakage')}
                className="flex items-center gap-2 w-full text-left hover:opacity-80">
                <span className="text-red-400 text-xs">🔴</span>
                <span className="text-red-300 text-xs">{leakageCount} leakage alerts</span>
              </button>
            )}
            {visaCount > 0 && (mode === 'us_only' || mode === 'both') && (
              <button onClick={() => navigate('/us')}
                className="flex items-center gap-2 w-full text-left hover:opacity-80">
                <span className="text-yellow-400 text-xs">🛂</span>
                <span className="text-yellow-300 text-xs">{visaCount} visa expiring</span>
              </button>
            )}
            {tsCount > 0 && (mode === 'us_only' || mode === 'both') && (
              <button onClick={() => navigate('/us')}
                className="flex items-center gap-2 w-full text-left hover:opacity-80">
                <span className="text-orange-400 text-xs">⏱️</span>
                <span className="text-orange-300 text-xs">{tsCount} timesheets unbilled</span>
              </button>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-gray-700 p-3">
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm">
            <span>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <PageTitle pathname={location.pathname} />
          <div className="flex items-center gap-3">
            {fxRate && (mode === 'us_only' || mode === 'both') && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                💱 1 USD = ₹{fxRate.toFixed(2)}
              </span>
            )}
            {(leakageCount + visaCount + tsCount) > 0 && (
              <button onClick={() => navigate('/revenue-leakage')}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100">
                🔴 {leakageCount + visaCount + tsCount} alerts
              </button>
            )}
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
          </div>
        </div>

        <div className="min-h-[calc(100vh-57px)]">
          {children}
        </div>
      </main>
    </div>
  )
}

// ─── Nav Item ─────────────────────────────────────────────────
function NavItem({ item, collapsed, badge, active }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-colors relative group ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <span className="text-base flex-shrink-0">{item.icon}</span>
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {badge > 0 && (
        <span className={`${collapsed ? 'absolute -top-1 -right-1' : ''} bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
          {item.label}
          {badge > 0 && <span className="ml-1 text-red-400">({badge})</span>}
        </div>
      )}
    </NavLink>
  )
}

// ─── Page Title ───────────────────────────────────────────────
function PageTitle({ pathname }) {
  const titles = {
    '/dashboard':       'Dashboard',
    '/employees':       'Employees',
    '/onboarding':      'Onboarding',
    '/attendance':      'Attendance',
    '/flexi':           'Flexi Staffing',
    '/clients':         'Clients',
    '/contracts':       'Client Contracts',
    '/work-orders':     'Work Orders / PO',
    '/deployments':     'Deployments',
    '/rpo':             'RPO Pipeline',
    '/us':              'US Staffing',
    '/payroll':         'Payroll',
    '/billing-recon':   'Billing Reconciliation',
    '/invoicing':       'Invoicing',
    '/compliance':      'Compliance',
    '/revenue-leakage': 'Revenue Leakage',
    '/settings':        'Settings',
  }
  return <h1 className="text-base font-semibold text-gray-800">{titles[pathname] || 'PeopleOne'}</h1>
}

// ─── Badge helper ─────────────────────────────────────────────
function getBadge(alertType, alerts) {
  if (alertType === 'leakage') return alerts.leakageCount
  if (alertType === 'us')      return (alerts.visaCount || 0) + (alerts.tsCount || 0)
  return 0
}
