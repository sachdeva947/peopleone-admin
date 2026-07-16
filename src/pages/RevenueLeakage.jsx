import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Alert Config ─────────────────────────────────────────────
const ALERT_CONFIG = {
  NO_WORK_ORDER:      { label: 'No Work Order',         icon: '📋', color: 'red',    desc: 'Deployed without PO/WO' },
  UNBILLED:           { label: 'Unbilled Payroll',       icon: '💸', color: 'red',    desc: 'Payroll done, invoice not raised' },
  TIMESHEET_UNBILLED: { label: 'Timesheet Unbilled',     icon: '⏱️', color: 'red',    desc: 'Approved timesheet, no invoice' },
  RPO_UNINVOICED:     { label: 'RPO Uninvoiced',         icon: '🎯', color: 'red',    desc: 'Candidate joined, invoice pending' },
  PO_EXHAUSTING:      { label: 'PO Almost Exhausted',    icon: '⚠️', color: 'yellow', desc: 'PO value >80% utilized' },
  BENCH_COST:         { label: 'Bench Cost Bleeding',    icon: '🪑', color: 'yellow', desc: 'Consultant on bench >30 days' },
}

const COLOR = {
  red:    { card: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    text: 'text-red-700'    },
  yellow: { card: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', text: 'text-yellow-700' },
}

// ─── Main Page ────────────────────────────────────────────────
export default function RevenueLeakage() {
  const [alerts, setAlerts]         = useState([])
  const [recon, setRecon]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [month, setMonth]           = useState(new Date().getMonth() + 1)
  const [year, setYear]             = useState(new Date().getFullYear())

  useEffect(() => { fetchAll() }, [month, year])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase.from('revenue_leakage_alerts').select('*').order('alert_type'),
      supabase
        .from('billing_reconciliation')
        .select('*, employees(first_name, last_name), clients(client_name)')
        .eq('month', month)
        .eq('year', year),
    ])
    setAlerts(a || [])
    setRecon(r || [])
    setLoading(false)
  }

  // ── Aggregates ────────────────────────────────────────────
  const criticalAlerts = alerts.filter(a => a.severity?.includes('Critical'))
  const warningAlerts  = alerts.filter(a => a.severity?.includes('Warning'))

  const totalAtRisk = alerts.reduce((sum, a) => sum + (+a.amount_at_risk || 0), 0)
  const criticalRisk = criticalAlerts.reduce((sum, a) => sum + (+a.amount_at_risk || 0), 0)

  const totalBilled    = recon.reduce((s, r) => s + (+r.total_billed    || 0), 0)
  const totalCost      = recon.reduce((s, r) => s + (+r.payroll_cost    || 0), 0)
  const totalAbsorbed  = recon.reduce((s, r) => s + (+r.absorbed_cost   || 0), 0)
  const totalMargin    = recon.reduce((s, r) => s + (+r.gross_margin    || 0), 0)
  const avgMarginPct   = totalBilled > 0 ? (totalMargin / totalBilled * 100).toFixed(1) : 0

  // Group alerts by type for summary
  const byType = {}
  alerts.forEach(a => {
    if (!byType[a.alert_type]) byType[a.alert_type] = { count: 0, amount: 0 }
    byType[a.alert_type].count++
    byType[a.alert_type].amount += (+a.amount_at_risk || 0)
  })

  const filtered = filterType === 'all' ? alerts : alerts.filter(a => a.alert_type === filterType)

  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Revenue Leakage</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time tracking of unbilled, untracked & margin erosion</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(+e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchAll}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* ── Top KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total At Risk"
              value={`₹${fmt(totalAtRisk)}`}
              sub={`${alerts.length} alerts`}
              color="red"
            />
            <KpiCard
              label="Critical Issues"
              value={criticalAlerts.length}
              sub={`₹${fmt(criticalRisk)} exposure`}
              color="red"
            />
            <KpiCard
              label="Cost Absorbed"
              value={`₹${fmt(totalAbsorbed)}`}
              sub="Leave + bench this month"
              color="yellow"
            />
            <KpiCard
              label="Effective Margin"
              value={`${avgMarginPct}%`}
              sub={totalBilled > 0 ? `Billed ₹${fmt(totalBilled)}` : 'No recon data'}
              color={+avgMarginPct >= 15 ? 'green' : +avgMarginPct >= 10 ? 'yellow' : 'red'}
            />
          </div>

          {/* ── Alert Type Summary ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Alert Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(ALERT_CONFIG).map(([type, cfg]) => {
                const data = byType[type]
                const col  = COLOR[cfg.color]
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    className={`border rounded-xl p-4 text-left transition-all hover:shadow-md ${
                      filterType === type ? `${col.card} ring-2 ring-offset-1 ${cfg.color === 'red' ? 'ring-red-400' : 'ring-yellow-400'}` : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{cfg.icon}</span>
                      {data && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                          {data.count}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm mt-2">{cfg.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
                    {data?.amount > 0 && (
                      <p className={`text-sm font-bold mt-2 ${col.text}`}>₹{fmt(data.amount)}</p>
                    )}
                    {!data && (
                      <p className="text-xs text-green-600 mt-2 font-medium">✓ Clear</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Alert List ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                {filterType === 'all' ? 'All Alerts' : ALERT_CONFIG[filterType]?.label}
                <span className="ml-2 font-normal text-gray-400">({filtered.length})</span>
              </h2>
              {filterType !== 'all' && (
                <button onClick={() => setFilterType('all')}
                  className="text-sm text-blue-600 hover:underline">
                  Show all
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-green-700 font-semibold">No leakage alerts!</p>
                <p className="text-green-600 text-sm mt-1">Everything looks clean for this filter.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((a, i) => {
                  const cfg = ALERT_CONFIG[a.alert_type] || { icon: '❓', color: 'yellow', label: a.alert_type }
                  const col = COLOR[cfg.color] || COLOR.yellow
                  return (
                    <div
                      key={i}
                      className={`border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow ${col.card}`}
                      onClick={() => setSelectedAlert(selectedAlert?.reference_id === a.reference_id ? null : a)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-0.5">{cfg.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}>
                                {cfg.label}
                              </span>
                              <span className="text-xs text-gray-400">{a.severity}</span>
                            </div>
                            <p className="font-semibold text-gray-900 mt-1">{a.entity_name}</p>
                            <p className="text-sm text-gray-500">Client: {a.client_name}</p>
                            {a.since && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Since: {new Date(a.since).toLocaleDateString('en-IN')}
                              </p>
                            )}
                          </div>
                        </div>
                        {a.amount_at_risk > 0 && (
                          <div className="text-right">
                            <p className={`text-lg font-bold ${col.text}`}>
                              ₹{fmt(a.amount_at_risk)}
                            </p>
                            <p className="text-xs text-gray-400">at risk</p>
                          </div>
                        )}
                      </div>

                      {/* Expanded action */}
                      {selectedAlert?.reference_id === a.reference_id && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 mb-2">RECOMMENDED ACTION</p>
                          <p className="text-sm text-gray-700">{getAction(a.alert_type)}</p>
                          <div className="flex gap-2 mt-3">
                            <ActionButton label="Mark Resolved" onClick={() => markResolved(a)} />
                            <ActionButton label="Raise Invoice" secondary onClick={() => {}} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Monthly Margin Table ── */}
          {recon.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Margin Reconciliation — {months[month - 1]} {year}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Employee', 'Client', 'Worked', 'Billed', 'Payroll', 'Absorbed', 'Leave Days', 'Margin'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {recon.map(r => {
                      const mp = r.margin_percent
                      const marginColor = mp >= 15 ? 'text-green-700' : mp >= 10 ? 'text-yellow-700' : 'text-red-700'
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.employees?.first_name} {r.employees?.last_name}</td>
                          <td className="px-4 py-3 text-gray-600">{r.clients?.client_name}</td>
                          <td className="px-4 py-3 text-gray-600">{r.worked_days}d</td>
                          <td className="px-4 py-3 text-green-700 font-semibold">₹{fmt(r.total_billed)}</td>
                          <td className="px-4 py-3 text-gray-600">₹{fmt(r.payroll_cost)}</td>
                          <td className="px-4 py-3">
                            {r.absorbed_cost > 0 ? (
                              <span className="text-red-600 font-medium">₹{fmt(r.absorbed_cost)}</span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.leave_days > 0 ? (
                              <span className="text-orange-600">{r.leave_days}d</span>
                            ) : <span className="text-gray-400">0</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${mp >= 15 ? 'bg-green-500' : mp >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(Math.max(mp, 0), 40) / 40 * 100}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold ${marginColor}`}>{mp?.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-3 font-bold text-green-700">₹{fmt(totalBilled)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">₹{fmt(totalCost)}</td>
                      <td className="px-4 py-3 font-bold text-red-600">₹{fmt(totalAbsorbed)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-bold text-gray-800">{avgMarginPct}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Margin Health Legend ── */}
          <div className="flex items-center gap-6 text-xs text-gray-500 pt-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Healthy ≥15%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Watch 10–15%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Critical &lt;10%</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  const colors = {
    red:    'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color] || colors.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold mt-1 opacity-75 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────
function ActionButton({ label, onClick, secondary }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
        secondary
          ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
function fmt(n) {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K'
  return Number(n).toFixed(0)
}

function getAction(alertType) {
  const actions = {
    NO_WORK_ORDER:      'Work order / PO obtain karo client se immediately. Deployment hold karo ya WO link karo.',
    UNBILLED:           'Billing reconciliation finalize karo aur invoice raise karo is month ke liye.',
    TIMESHEET_UNBILLED: 'Approved timesheet ke basis pe invoice raise karo. Client ko timesheet re-confirm karo.',
    RPO_UNINVOICED:     'Candidate joining confirm hai — placement fee invoice bhejo client ko.',
    PO_EXHAUSTING:      'Client se PO renewal/amendment request karo before value exhausts.',
    BENCH_COST:         'Consultant ko naye project pe submit karo. Bench cost absorb ho raha hai daily.',
  }
  return actions[alertType] || 'Review karo aur appropriate action lo.'
}

async function markResolved(alert) {
  // Placeholder — in real flow, specific resolution per alert type
  alert('Resolution tracking coming soon. Manually verify in respective module.')
}
