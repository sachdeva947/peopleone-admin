import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600'    },
  finalized: { label: 'Finalized', color: 'bg-blue-100 text-blue-800'    },
  invoiced:  { label: 'Invoiced',  color: 'bg-green-100 text-green-800'  },
}

// ─── Main Page ────────────────────────────────────────────────
export default function BillingReconciliation() {
  const now = new Date()
  const [month, setMonth]       = useState(now.getMonth() + 1)
  const [year, setYear]         = useState(now.getFullYear())
  const [recons, setRecons]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filterClient, setFilterClient] = useState('all')
  const [clients, setClients]   = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchAll() }, [month, year])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: cl }] = await Promise.all([
      supabase
        .from('billing_reconciliation')
        .select('*, employees(first_name, last_name, employee_code), clients(client_name)')
        .eq('month', month)
        .eq('year', year)
        .order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setRecons(r || [])
    setClients(cl || [])
    setLoading(false)
  }

  // ── Auto-Generate Reconciliation ──────────────────────────
  async function generateReconciliation() {
    setGenerating(true)

    // Fetch active deployments for this month
    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`
    const monthEnd   = new Date(year, month, 0).toISOString().split('T')[0]

    const { data: deployments } = await supabase
      .from('deployments')
      .select('*, employees(first_name, last_name, employee_code), clients(client_name), client_contracts(id), contract_billing_policy(*)')
      .eq('billing_status', 'active')
      .lte('start_date', monthEnd)
      .or(`end_date.gte.${monthStart},end_date.is.null`)

    if (!deployments?.length) {
      alert('Koi active deployment nahi mila is month ke liye.')
      setGenerating(false)
      return
    }

    let created = 0, skipped = 0

    for (const dep of deployments) {
      // Skip if already exists
      const { data: existing } = await supabase
        .from('billing_reconciliation')
        .select('id')
        .eq('employee_id', dep.employee_id)
        .eq('client_id', dep.client_id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Fetch attendance/payroll data
      const { data: payroll } = await supabase
        .from('payroll')
        .select('*')
        .eq('employee_id', dep.employee_id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', dep.employee_id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      // Billing policy from contract
      const policy = dep.contract_billing_policy?.[0] || null
      const workingDays  = policy?.working_days_per_month || 26
      const leavePolicy  = policy?.leave_policy || 'actual_days'
      const otBillable   = policy?.ot_billable || false
      const otMultiplier = policy?.ot_multiplier || 1.5

      // Days calculation
      const workedDays  = attendance?.present_days  || payroll?.working_days || workingDays
      const lopDays     = attendance?.lop_days       || payroll?.lop_days     || 0
      const leaveDays   = attendance?.leave_days     || 0
      const holidayDays = attendance?.holiday_days   || 0
      const otHours     = attendance?.ot_hours       || 0
      const payrollDays = workedDays + leaveDays + holidayDays

      // Billable days per policy
      let billableDays = workedDays
      if (leavePolicy === 'fixed_monthly')    billableDays = workingDays
      if (leavePolicy === 'contracted_days')  billableDays = workingDays
      if (leavePolicy === 'actual_days') {
        const billableLeaves = Math.min(leaveDays, policy?.billable_leave_days || 0)
        const billableHolidays = policy?.holiday_billable ? holidayDays : 0
        billableDays = workedDays + billableLeaves + billableHolidays
      }

      // Rate calculations
      const billRate      = dep.bill_rate || 0
      const payRateM      = dep.pay_rate  || 0
      const dailyBillRate = dep.bill_rate_unit === 'monthly' ? billRate / workingDays
                          : dep.bill_rate_unit === 'daily'   ? billRate : billRate * 8
      const dailyCostRate = dep.bill_rate_unit === 'monthly' ? payRateM / workingDays
                          : dep.bill_rate_unit === 'daily'   ? payRateM : payRateM * 8

      const billedAmount = billableDays * dailyBillRate
      const otBilledAmt  = otBillable ? (otHours * dailyBillRate / 8 * otMultiplier) : 0
      const totalBilled  = billedAmount + otBilledAmt

      const payrollCost  = payrollDays * dailyCostRate
      const absorbedDays = Math.max(0, payrollDays - billableDays)
      const absorbedCost = absorbedDays * dailyCostRate

      const employerPF   = payroll?.employer_pf   || 0
      const employerESIC = payroll?.employer_esic  || 0

      const grossMargin  = totalBilled - payrollCost - employerPF - employerESIC
      const marginPct    = totalBilled > 0 ? (grossMargin / totalBilled * 100) : 0

      await supabase.from('billing_reconciliation').insert({
        employee_id:     dep.employee_id,
        deployment_id:   dep.id,
        client_id:       dep.client_id,
        month,
        year,
        calendar_days:   new Date(year, month, 0).getDate(),
        worked_days:     workedDays,
        leave_days:      leaveDays,
        holiday_days:    holidayDays,
        lop_days:        lopDays,
        ot_hours:        otHours,
        billable_days:   billableDays,
        bill_rate_daily: dailyBillRate,
        billed_amount:   billedAmount,
        ot_billed_amount: otBilledAmt,
        total_billed:    totalBilled,
        payroll_days:    payrollDays,
        daily_cost:      dailyCostRate,
        payroll_cost:    payrollCost,
        employer_pf:     employerPF,
        employer_esic:   employerESIC,
        absorbed_days:   absorbedDays,
        absorbed_cost:   absorbedCost,
        gross_margin:    grossMargin,
        margin_percent:  marginPct,
        status:          'draft',
      })
      created++
    }

    alert(`✅ Done!\n${created} records created\n${skipped} already existed`)
    setGenerating(false)
    fetchAll()
  }

  // ── Filtered data ─────────────────────────────────────────
  const filtered = recons.filter(r =>
    filterClient === 'all' || r.client_id === filterClient
  )

  // ── Totals ────────────────────────────────────────────────
  const totals = filtered.reduce((acc, r) => ({
    billed:   acc.billed   + (+r.total_billed   || 0),
    cost:     acc.cost     + (+r.payroll_cost    || 0),
    absorbed: acc.absorbed + (+r.absorbed_cost   || 0),
    margin:   acc.margin   + (+r.gross_margin    || 0),
    pf:       acc.pf       + (+r.employer_pf     || 0),
    esic:     acc.esic     + (+r.employer_esic   || 0),
  }), { billed: 0, cost: 0, absorbed: 0, margin: 0, pf: 0, esic: 0 })

  const avgMargin = totals.billed > 0
    ? (totals.margin / totals.billed * 100).toFixed(1) : 0

  const draftCount     = filtered.filter(r => r.status === 'draft').length
  const finalizedCount = filtered.filter(r => r.status === 'finalized').length
  const invoicedCount  = filtered.filter(r => r.status === 'invoiced').length

  // ── Bulk finalize ─────────────────────────────────────────
  async function finalizeAll() {
    if (!draftCount) { alert('Koi draft record nahi hai'); return }
    if (!confirm(`${draftCount} draft records finalize karein?`)) return
    const ids = filtered.filter(r => r.status === 'draft').map(r => r.id)
    await supabase
      .from('billing_reconciliation')
      .update({ status: 'finalized' })
      .in('id', ids)
    fetchAll()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Billing Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Worked vs Billed vs Absorbed — monthly margin engine</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateReconciliation}
            disabled={generating}
            className={`bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {generating ? '⚙️ Generating...' : '⚡ Auto-Generate'}
          </button>
          {draftCount > 0 && (
            <button onClick={finalizeAll}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              ✅ Finalize All ({draftCount})
            </button>
          )}
        </div>
      </div>

      {/* Month/Year Selector */}
      <div className="flex gap-3 mb-6 items-center">
        <select value={month} onChange={e => setMonth(+e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
        </select>
        <button onClick={fetchAll}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
          Refresh
        </button>
        <span className="text-sm text-gray-400 ml-2">
          {MONTHS[month-1]} {year} — {filtered.length} records
        </span>
      </div>

      {/* KPI Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total Billed"    value={`₹${fmtShort(totals.billed)}`}   color="blue"   />
          <KpiCard label="Payroll Cost"    value={`₹${fmtShort(totals.cost)}`}     color="gray"   />
          <KpiCard label="PF + ESIC"       value={`₹${fmtShort(totals.pf + totals.esic)}`} color="gray" />
          <KpiCard label="Absorbed (Leak)" value={`₹${fmtShort(totals.absorbed)}`} color="red"    />
          <KpiCard label="Net Margin"      value={`${avgMargin}%`}
            color={+avgMargin >= 15 ? 'green' : +avgMargin >= 10 ? 'yellow' : 'red'} />
        </div>
      )}

      {/* Status Row */}
      {filtered.length > 0 && (
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-gray-500">Draft: <strong className="text-gray-700">{draftCount}</strong></span>
          <span className="text-gray-500">Finalized: <strong className="text-blue-700">{finalizedCount}</strong></span>
          <span className="text-gray-500">Invoiced: <strong className="text-green-700">{invoicedCount}</strong></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState month={MONTHS[month-1]} year={year} onGenerate={generateReconciliation} generating={generating} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Client', 'Days Worked', 'Days Billed', 'Absorbed', 'Billed Amt',
                  'Payroll Cost', 'PF+ESIC', 'Gross Margin', 'Margin %', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(r => {
                const mp = +r.margin_percent
                const marginColor = mp >= 15 ? 'text-green-700' : mp >= 10 ? 'text-yellow-700' : 'text-red-600'
                const marginBg    = mp >= 15 ? 'bg-green-500'  : mp >= 10 ? 'bg-yellow-500'  : 'bg-red-500'

                return (
                  <tr key={r.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(r)}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{r.employees?.first_name} {r.employees?.last_name}</p>
                      <p className="text-xs text-gray-400">{r.employees?.employee_code}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{r.clients?.client_name}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-medium text-gray-800">{r.worked_days}</span>
                      {r.leave_days > 0 && (
                        <span className="text-xs text-orange-500 ml-1">(+{r.leave_days}L)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-blue-700">{r.billable_days}</td>
                    <td className="px-3 py-3 text-center">
                      {r.absorbed_days > 0 ? (
                        <span className="text-red-600 font-medium">{r.absorbed_days}d</span>
                      ) : <span className="text-green-600">—</span>}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">₹{fmt(r.total_billed)}</td>
                    <td className="px-3 py-3 text-gray-600">₹{fmt(r.payroll_cost)}</td>
                    <td className="px-3 py-3 text-gray-500">
                      ₹{fmt((+r.employer_pf || 0) + (+r.employer_esic || 0))}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">₹{fmt(r.gross_margin)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${marginBg}`}
                            style={{ width: `${Math.min(Math.max(mp,0),40)/40*100}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${marginColor}`}>{mp.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[r.status]?.color}`}>
                        {STATUS_CONFIG[r.status]?.label}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <StatusDropdown recon={r} onUpdate={fetchAll} />
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totals Footer */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-gray-700">
                  Total — {filtered.length} employees
                </td>
                <td className="px-3 py-3 text-gray-900">₹{fmt(totals.billed)}</td>
                <td className="px-3 py-3 text-gray-700">₹{fmt(totals.cost)}</td>
                <td className="px-3 py-3 text-gray-600">₹{fmt(totals.pf + totals.esic)}</td>
                <td className="px-3 py-3 text-gray-900">₹{fmt(totals.margin)}</td>
                <td className="px-3 py-3">
                  <span className={`font-bold ${+avgMargin >= 15 ? 'text-green-700' : +avgMargin >= 10 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {avgMargin}%
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <ReconDetailPanel
          recon={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => { fetchAll(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ─── Status Dropdown ──────────────────────────────────────────
function StatusDropdown({ recon, onUpdate }) {
  const [open, setOpen] = useState(false)

  async function setStatus(status) {
    await supabase
      .from('billing_reconciliation')
      .update({ status })
      .eq('id', recon.id)
    setOpen(false)
    onUpdate()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded text-sm">
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px]">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            recon.status !== k && (
              <button key={k} onClick={() => setStatus(k)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Set {v.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Recon Detail Panel ───────────────────────────────────────
function ReconDetailPanel({ recon: r, onClose, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...r })

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveEdits() {
    const { error } = await supabase
      .from('billing_reconciliation')
      .update({
        worked_days:      +form.worked_days,
        leave_days:       +form.leave_days,
        holiday_days:     +form.holiday_days,
        lop_days:         +form.lop_days,
        ot_hours:         +form.ot_hours,
        billable_days:    +form.billable_days,
        billed_amount:    +form.billed_amount,
        ot_billed_amount: +form.ot_billed_amount,
        total_billed:     +form.total_billed,
        payroll_cost:     +form.payroll_cost,
        employer_pf:      +form.employer_pf,
        employer_esic:    +form.employer_esic,
        absorbed_days:    +form.absorbed_days,
        absorbed_cost:    +form.absorbed_cost,
        gross_margin:     +form.gross_margin,
        margin_percent:   +form.margin_percent,
      })
      .eq('id', r.id)
    if (error) { alert(error.message); return }
    setEditing(false)
    onUpdate()
  }

  const mp = +r.margin_percent

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{r.employees?.first_name} {r.employees?.last_name}</h2>
            <p className="text-sm text-gray-500">{r.clients?.client_name} · {MONTHS[r.month-1]} {r.year}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setEditing(!editing)}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
            {editing && (
              <button onClick={saveEdits}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                Save
              </button>
            )}
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Margin Banner */}
          <div className={`border rounded-xl p-4 ${mp >= 15 ? 'bg-green-50 border-green-200' : mp >= 10 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Net Margin</p>
                <p className={`text-4xl font-bold mt-1 ${mp >= 15 ? 'text-green-700' : mp >= 10 ? 'text-yellow-700' : 'text-red-700'}`}>
                  {mp.toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Gross Margin</p>
                <p className="text-xl font-bold text-gray-800">₹{fmt(r.gross_margin)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Billed ₹{fmt(r.total_billed)} − Cost ₹{fmt((+r.payroll_cost||0)+(+r.employer_pf||0)+(+r.employer_esic||0))}
                </p>
              </div>
            </div>
          </div>

          {/* Days Breakdown */}
          <Section title="Days Breakdown">
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['worked_days',   'Worked Days'],
                  ['leave_days',    'Leave Days'],
                  ['holiday_days',  'Holiday Days'],
                  ['lop_days',      'LOP Days'],
                  ['billable_days', 'Billable Days'],
                  ['ot_hours',      'OT Hours'],
                ].map(([k, label]) => (
                  <ERow key={k} label={label}>
                    <input type="number" step="0.5" className={inp}
                      value={form[k] || 0}
                      onChange={e => setF(k, e.target.value)} />
                  </ERow>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <DayBar label="Worked"        days={r.worked_days}   total={r.calendar_days} color="blue"   />
                <DayBar label="Leave (EL/SL)" days={r.leave_days}    total={r.calendar_days} color="orange" />
                <DayBar label="Holidays"      days={r.holiday_days}  total={r.calendar_days} color="purple" />
                <DayBar label="LOP"           days={r.lop_days}      total={r.calendar_days} color="gray"   />
                <div className="border-t pt-2 mt-2">
                  <DayBar label="Billable (→ Invoice)" days={r.billable_days} total={r.calendar_days} color="green" bold />
                  <DayBar label="Absorbed (cost leak)"  days={r.absorbed_days} total={r.calendar_days} color="red"  />
                </div>
                {r.ot_hours > 0 && (
                  <p className="text-sm text-gray-600 mt-1">OT Hours: <strong>{r.ot_hours}h</strong></p>
                )}
              </div>
            )}
          </Section>

          {/* Billing */}
          <Section title="Billing">
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['billed_amount',    'Base Billed (₹)'],
                  ['ot_billed_amount', 'OT Billed (₹)'],
                  ['total_billed',     'Total Billed (₹)'],
                ].map(([k, label]) => (
                  <ERow key={k} label={label}>
                    <input type="number" className={inp}
                      value={form[k] || 0}
                      onChange={e => setF(k, e.target.value)} />
                  </ERow>
                ))}
              </div>
            ) : (
              <Grid2>
                <Detail label="Daily Bill Rate" value={`₹${fmt(r.bill_rate_daily)}`} />
                <Detail label="Billable Days"   value={r.billable_days} />
                <Detail label="Base Amount"     value={`₹${fmt(r.billed_amount)}`} />
                <Detail label="OT Billed"       value={r.ot_billed_amount > 0 ? `₹${fmt(r.ot_billed_amount)}` : '—'} />
                <Detail label="Total Billed" value={`₹${fmt(r.total_billed)}`} bold />
              </Grid2>
            )}
          </Section>

          {/* Cost */}
          <Section title="Cost Breakdown">
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['payroll_cost',  'Payroll Cost (₹)'],
                  ['employer_pf',   'Employer PF (₹)'],
                  ['employer_esic', 'Employer ESIC (₹)'],
                  ['absorbed_cost', 'Absorbed Cost (₹)'],
                ].map(([k, label]) => (
                  <ERow key={k} label={label}>
                    <input type="number" className={inp}
                      value={form[k] || 0}
                      onChange={e => setF(k, e.target.value)} />
                  </ERow>
                ))}
              </div>
            ) : (
              <Grid2>
                <Detail label="Daily Cost"      value={`₹${fmt(r.daily_cost)}`} />
                <Detail label="Payroll Days"    value={r.payroll_days} />
                <Detail label="Payroll Cost"    value={`₹${fmt(r.payroll_cost)}`} />
                <Detail label="Employer PF"     value={`₹${fmt(r.employer_pf)}`} />
                <Detail label="Employer ESIC"   value={`₹${fmt(r.employer_esic)}`} />
                <Detail label="Absorbed Cost"   value={r.absorbed_cost > 0 ? `₹${fmt(r.absorbed_cost)}` : '—'} red={r.absorbed_cost > 0} />
              </Grid2>
            )}
          </Section>

          {/* Status */}
          <Section title="Status">
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k}
                  onClick={async () => {
                    await supabase.from('billing_reconciliation').update({ status: k }).eq('id', r.id)
                    onUpdate()
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    r.status === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ month, year, onGenerate, generating }) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
      <p className="text-4xl mb-3">📊</p>
      <p className="text-gray-700 font-semibold text-lg">{month} {year} — No records yet</p>
      <p className="text-gray-400 text-sm mt-1 mb-4">
        Auto-generate karo active deployments + attendance data se
      </p>
      <button onClick={onGenerate} disabled={generating}
        className={`bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ${generating ? 'opacity-50' : ''}`}>
        {generating ? '⚙️ Generating...' : '⚡ Generate Reconciliation'}
      </button>
    </div>
  )
}

// ─── Day Bar ──────────────────────────────────────────────────
function DayBar({ label, days, total, color, bold }) {
  const pct = total > 0 ? Math.min((days / total) * 100, 100) : 0
  const colors = {
    blue:   'bg-blue-500',
    green:  'bg-green-500',
    orange: 'bg-orange-400',
    purple: 'bg-purple-400',
    red:    'bg-red-500',
    gray:   'bg-gray-400',
  }
  if (!days || days == 0) return null
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className={`text-sm w-40 text-gray-600 ${bold ? 'font-semibold text-gray-800' : ''}`}>{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${colors[color]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm w-12 text-right font-medium ${bold ? 'text-gray-900' : 'text-gray-600'}`}>{days}d</span>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, color }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-semibold mt-1 opacity-70 uppercase tracking-wide">{label}</p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function ERow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}
function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}
function Grid2({ children }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
}
function Detail({ label, value, bold, red }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium ${bold ? 'text-gray-900 font-bold' : red ? 'text-red-600' : 'text-gray-800'}`}>
        {value ?? '—'}
      </p>
    </div>
  )
}
function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function fmtShort(n) {
  if (!n) return '0'
  if (n >= 10000000) return (n/10000000).toFixed(1)+'Cr'
  if (n >= 100000)   return (n/100000).toFixed(1)+'L'
  if (n >= 1000)     return (n/1000).toFixed(1)+'K'
  return Number(n).toFixed(0)
}
