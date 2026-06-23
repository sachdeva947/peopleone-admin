import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Compliance() {
  const [activeTab, setActiveTab] = useState('ecr')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'ecr',      label: '📄 PF ECR File' },
          { key: 'uan',      label: '🔢 UAN Pending' },
          { key: 'esic',     label: '🏥 ESIC' },
          { key: 'pt',       label: '💼 Prof. Tax' },
          { key: 'lwf',      label: '⚖️ LWF' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'ecr'  && <ECRGenerator />}
      {activeTab === 'uan'  && <UANPending />}
      {activeTab === 'esic' && <ESICChallan />}
      {activeTab === 'pt'   && <PTChallan />}
      {activeTab === 'lwf'  && <LWFChallan />}
    </div>
  )
}

// ── ECR GENERATOR ─────────────────────────────────────────────
function ECRGenerator() {
  const [month, setMonth] = useState('')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    async function fetchCompany() {
      const { data } = await supabase.from('companies').select('*').limit(1).single()
      if (data) setCompany(data)
    }
    fetchCompany()
  }, [])

  async function fetchPayrollData() {
    if (!month) return
    setLoading(true)

    // Get payroll month
    const { data: pm } = await supabase
      .from('payroll_months')
      .select('id')
      .eq('payroll_month', month + '-01')
      .single()

    if (!pm) {
      alert('No payroll found for this month! Run payroll first.')
      setLoading(false)
      return
    }

    // Get employee payroll with UAN
    const { data } = await supabase
      .from('employee_payroll')
      .select(`
        *,
        employees(
          first_name, last_name, uan_number,
          date_of_joining, old_uan
        ),
        attendance(lop_days)
      `)
      .eq('payroll_month_id', pm.id)

    if (data) {
      // Only employees with UAN
      const withUAN = data.filter(ep => ep.employees?.uan_number)
      setEmployees(withUAN)
    }
    setLoading(false)
  }

  function generateECR() {
    if (employees.length === 0) return

    // ECR Header
    const header = `#~#UAN~#~#MemberName~#~#GrossWages~#~#EPFWages~#~#ETContribution~#~#EPSContribution~#~#EPFContribution~#~#NCPDays~#~#RefundOfAdvances`

    const rows = employees.map(ep => {
      const basic = Number(ep.basic) || 0
      const gross = Number(ep.gross_earnings) || 0
      const epfWage = Math.min(basic, 15000)
      const eeShare = Math.min(Math.round(epfWage * 0.12), 1800)  // Employee 12%
      const epsShare = Math.min(Math.round(epfWage * 0.0833), 1250) // EPS 8.33%
      const epfShare = eeShare - epsShare  // EPF diff 3.67%
      const ncpDays = ep.attendance?.[0]?.lop_days || 0
      const name = `${ep.employees?.first_name} ${ep.employees?.last_name || ''}`.trim()

      return [
        ep.employees?.uan_number,
        name,
        Math.round(gross),
        Math.round(epfWage),
        eeShare,
        epsShare,
        epfShare,
        ncpDays,
        0  // Refund of advances
      ].join('~#~')
    })

    const content = [header, ...rows].join('\n')

    // Download
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ECR_${company?.pf_establishment_id || 'PF'}_${month.replace('-', '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary calculations
  const totalEE = employees.reduce((s, ep) => {
    const epfWage = Math.min(Number(ep.basic) || 0, 15000)
    return s + Math.min(Math.round(epfWage * 0.12), 1800)
  }, 0)

  const totalER = employees.reduce((s, ep) => {
    const epfWage = Math.min(Number(ep.basic) || 0, 15000)
    return s + Math.min(Math.round(epfWage * 0.12), 1800)
  }, 0)

  const totalPF = totalEE + totalER

  return (
    <div className="max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-blue-900 font-medium text-sm">📋 ECR Type 2 — Monthly Return</p>
        <p className="text-blue-700 text-xs mt-1">
          PF Establishment ID: <b>{company?.pf_establishment_id || 'Not set — update in Settings'}</b>
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Payroll Month *</label>
            <input type="month" value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="mt-5">
            <button onClick={fetchPayrollData} disabled={!month || loading}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Loading...' : 'Load Payroll Data'}
            </button>
          </div>
        </div>
      </div>

      {employees.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Employees with UAN', value: employees.length, color: 'text-blue-900' },
              { label: 'Employee PF (EE)', value: `Rs.${totalEE.toLocaleString()}`, color: 'text-red-500' },
              { label: 'Employer PF (ER)', value: `Rs.${totalER.toLocaleString()}`, color: 'text-orange-500' },
              { label: 'Total Challan', value: `Rs.${totalPF.toLocaleString()}`, color: 'text-green-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Employee list */}
          <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="px-4 py-3 text-left">UAN</th>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">EPF Wages</th>
                    <th className="px-4 py-3 text-right">EE (12%)</th>
                    <th className="px-4 py-3 text-right">EPS (8.33%)</th>
                    <th className="px-4 py-3 text-right">EPF (3.67%)</th>
                    <th className="px-4 py-3 text-center">NCP Days</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((ep, i) => {
                    const basic = Number(ep.basic) || 0
                    const gross = Number(ep.gross_earnings) || 0
                    const epfWage = Math.min(basic, 15000)
                    const ee = Math.min(Math.round(epfWage * 0.12), 1800)
                    const eps = Math.min(Math.round(epfWage * 0.0833), 1250)
                    const epf = ee - eps
                    const ncp = ep.attendance?.[0]?.lop_days || 0
                    return (
                      <tr key={ep.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-2 font-mono text-xs text-blue-700">{ep.employees?.uan_number}</td>
                        <td className="px-4 py-2 font-medium">
                          {ep.employees?.first_name} {ep.employees?.last_name || ''}
                        </td>
                        <td className="px-4 py-2 text-right">Rs.{Math.round(gross).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">Rs.{epfWage.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-red-500">Rs.{ee.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-orange-500">Rs.{eps.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-blue-600">Rs.{epf.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          {ncp > 0
                            ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs">{ncp}</span>
                            : <span className="text-gray-300">0</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Download button */}
          <button onClick={generateECR}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2">
            ⬇️ Download ECR File (.txt)
          </button>
          <p className="text-gray-400 text-xs mt-2">
            Upload this file on EPFO Unified Portal → ECR Upload
          </p>
        </>
      )}
    </div>
  )
}

// ── UAN PENDING ───────────────────────────────────────────────
function UANPending() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [uanInput, setUanInput] = useState({})

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, designation, date_of_joining, pan, client_sites(site_name)')
        .eq('status', 'active')
        .is('uan_number', null)
        .order('date_of_joining')
      if (data) setEmployees(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function updateUAN(empId) {
    const uan = uanInput[empId]
    if (!uan || uan.length !== 12) {
      alert('UAN must be 12 digits!')
      return
    }
    setUpdating(empId)
    await supabase
      .from('employees')
      .update({ uan_number: uan })
      .eq('id', empId)
    setUpdating(null)
    setEmployees(prev => prev.filter(e => e.id !== empId))
  }

  function exportList() {
    const headers = ['Emp Code', 'Name', 'Designation', 'Date of Joining', 'PAN', 'Site']
    const rows = employees.map(e => [
      e.employee_code,
      `${e.first_name} ${e.last_name || ''}`,
      e.designation || '—',
      e.date_of_joining ? new Date(e.date_of_joining).toLocaleDateString('en-IN') : '—',
      e.pan || '—',
      e.client_sites?.site_name || '—',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `UAN_Pending_${new Date().toLocaleDateString('en-IN').replace(/\//g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">UAN Pending ({employees.length})</h3>
          <p className="text-sm text-gray-400">These employees need UAN registration on EPFO portal</p>
        </div>
        {employees.length > 0 && (
          <button onClick={exportList}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            ⬇️ Export List (CSV)
          </button>
        )}
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-400">All active employees have UAN numbers!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-left">Joining</th>
                <th className="px-4 py-3 text-left">PAN</th>
                <th className="px-4 py-3 text-left">Update UAN</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{emp.first_name} {emp.last_name || ''}</p>
                    <p className="text-xs text-gray-400">{emp.employee_code}</p>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{emp.designation || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{emp.pan || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="12-digit UAN"
                        maxLength={12}
                        value={uanInput[emp.id] || ''}
                        onChange={e => setUanInput({ ...uanInput, [emp.id]: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => updateUAN(emp.id)}
                        disabled={updating === emp.id}
                        className="bg-blue-900 text-white px-3 py-1 rounded text-xs hover:bg-blue-800 disabled:opacity-50">
                        {updating === emp.id ? '...' : 'Save'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── ESIC CHALLAN ──────────────────────────────────────────────
function ESICChallan() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    async function fetchCompany() {
      const { data } = await supabase.from('companies').select('*').limit(1).single()
      if (data) setCompany(data)
    }
    fetchCompany()
  }, [])

  async function fetchData() {
    if (!month) return
    setLoading(true)
    const { data: pm } = await supabase
      .from('payroll_months').select('id')
      .eq('payroll_month', month + '-01').single()

    if (!pm) { alert('No payroll found!'); setLoading(false); return }

    const { data: ep } = await supabase
      .from('employee_payroll')
      .select('*, employees(first_name, last_name, esic_ip_number)')
      .eq('payroll_month_id', pm.id)
      .gt('esic_employee', 0)

    if (ep) setData(ep)
    setLoading(false)
  }

  const totalEE = data.reduce((s, e) => s + Number(e.esic_employee), 0)
  const totalER = data.reduce((s, e) => s + Number(e.esic_employer), 0)
  const total = totalEE + totalER

  return (
    <div className="max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-blue-900 font-medium text-sm">🏥 ESIC Monthly Challan</p>
        <p className="text-blue-700 text-xs mt-1">
          ESIC Code: <b>{company?.esic_code || 'Not set — update in Settings'}</b>
        </p>
        <p className="text-blue-600 text-xs mt-1">
          Applicable for employees with Gross ≤ ₹21,000/month
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Month *</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="mt-5">
            <button onClick={fetchData} disabled={!month || loading}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xl font-bold text-blue-900">{data.length}</p>
              <p className="text-xs text-gray-400">ESIC Employees</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xl font-bold text-red-500">Rs.{totalEE.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Employee (0.75%)</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xl font-bold text-green-600">Rs.{total.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Challan</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b">
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">IP Number</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">EE (0.75%)</th>
                  <th className="px-4 py-3 text-right">ER (3.25%)</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((ep, i) => (
                  <tr key={ep.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-2 font-medium">
                      {ep.employees?.first_name} {ep.employees?.last_name || ''}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {ep.employees?.esic_ip_number || '—'}
                    </td>
                    <td className="px-4 py-2 text-right">Rs.{Number(ep.gross_earnings).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-500">Rs.{Number(ep.esic_employee).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-orange-500">Rs.{Number(ep.esic_employer).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      Rs.{(Number(ep.esic_employee) + Number(ep.esic_employer)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right text-red-500">Rs.{totalEE.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-500">Rs.{totalER.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600">Rs.{total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {data.length === 0 && month && !loading && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400">No ESIC applicable employees for this month.</p>
          <p className="text-gray-300 text-xs mt-1">(Employees with Gross &gt; ₹21,000 are exempt)</p>
        </div>
      )}
    </div>
  )
}

// ── PT CHALLAN ────────────────────────────────────────────────
function PTChallan() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchData() {
    if (!month) return
    setLoading(true)
    const { data: pm } = await supabase
      .from('payroll_months').select('id')
      .eq('payroll_month', month + '-01').single()

    if (!pm) { alert('No payroll found!'); setLoading(false); return }

    const { data: ep } = await supabase
      .from('employee_payroll')
      .select('*, employees(first_name, last_name)')
      .eq('payroll_month_id', pm.id)
      .gt('pt_employee', 0)

    if (ep) {
      // Group by state
      const byState = {}
      ep.forEach(e => {
        if (!byState[e.state_code]) byState[e.state_code] = []
        byState[e.state_code].push(e)
      })
      setData(byState)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-yellow-800 font-medium text-sm">💼 Professional Tax — State-wise Challan</p>
        <p className="text-yellow-700 text-xs mt-1">
          PT is state-specific. Each state has separate challan and registration.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Month *</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="mt-5">
            <button onClick={fetchData} disabled={!month || loading}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {Object.keys(data).length > 0 && (
        <div className="space-y-4">
          {Object.entries(data).map(([state, employees]) => {
            const total = employees.reduce((s, e) => s + Number(e.pt_employee), 0)
            return (
              <div key={state} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="bg-blue-900 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-yellow-400 text-blue-900 font-bold px-2 py-0.5 rounded text-sm">{state}</span>
                    <span className="text-white font-medium">{employees.length} employees</span>
                  </div>
                  <span className="text-yellow-300 font-bold">Total: Rs.{total.toLocaleString()}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b">
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-right">Gross</th>
                      <th className="px-4 py-2 text-right">PT Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((ep, i) => (
                      <tr key={ep.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-2 font-medium">
                          {ep.employees?.first_name} {ep.employees?.last_name || ''}
                        </td>
                        <td className="px-4 py-2 text-right">Rs.{Number(ep.gross_earnings).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-medium text-orange-600">
                          Rs.{Number(ep.pt_employee).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── LWF CHALLAN ───────────────────────────────────────────────
function LWFChallan() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchData() {
    if (!month) return
    setLoading(true)
    const { data: pm } = await supabase
      .from('payroll_months').select('id')
      .eq('payroll_month', month + '-01').single()

    if (!pm) { alert('No payroll found!'); setLoading(false); return }

    const { data: ep } = await supabase
      .from('employee_payroll')
      .select('*, employees(first_name, last_name)')
      .eq('payroll_month_id', pm.id)
      .gt('lwf_employee', 0)

    if (ep) {
      const byState = {}
      ep.forEach(e => {
        if (!byState[e.state_code]) byState[e.state_code] = []
        byState[e.state_code].push(e)
      })
      setData(byState)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <p className="text-purple-800 font-medium text-sm">⚖️ Labour Welfare Fund — State-wise</p>
        <p className="text-purple-700 text-xs mt-1">
          LWF applicable in June & December (some states annual in December only)
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Month *</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="mt-5">
            <button onClick={fetchData} disabled={!month || loading}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {Object.keys(data).length > 0 && (
        <div className="space-y-4">
          {Object.entries(data).map(([state, employees]) => {
            const totalEE = employees.reduce((s, e) => s + Number(e.lwf_employee), 0)
            const totalER = employees.reduce((s, e) => s + Number(e.lwf_employer), 0)
            const total = totalEE + totalER
            return (
              <div key={state} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="bg-purple-900 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-yellow-400 text-purple-900 font-bold px-2 py-0.5 rounded text-sm">{state}</span>
                    <span className="text-white font-medium">{employees.length} employees</span>
                  </div>
                  <span className="text-yellow-300 font-bold">Total: Rs.{total.toLocaleString()}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b">
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-right">EE Amount</th>
                      <th className="px-4 py-2 text-right">ER Amount</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((ep, i) => (
                      <tr key={ep.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-2 font-medium">
                          {ep.employees?.first_name} {ep.employees?.last_name || ''}
                        </td>
                        <td className="px-4 py-2 text-right text-red-500">Rs.{Number(ep.lwf_employee).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-orange-500">Rs.{Number(ep.lwf_employer).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          Rs.{(Number(ep.lwf_employee) + Number(ep.lwf_employer)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right text-red-500">Rs.{totalEE.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-orange-500">Rs.{totalER.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-purple-700">Rs.{total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {Object.keys(data).length === 0 && month && !loading && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400">No LWF applicable for this month.</p>
          <p className="text-gray-300 text-xs mt-1">(LWF applicable only in June & December)</p>
        </div>
      )}
    </div>
  )
}

export default Compliance