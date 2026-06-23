import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Attendance() {
  const [activeTab, setActiveTab] = useState('entry')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'entry',   label: '📅 Attendance Entry' },
          { key: 'summary', label: '📊 Monthly Summary' },
          { key: 'lop',     label: '⚠️ LOP Register' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'entry'   && <AttendanceEntry />}
      {activeTab === 'summary' && <MonthlySummary />}
      {activeTab === 'lop'     && <LOPRegister />}
    </div>
  )
}

function AttendanceEntry() {
  const [month, setMonth] = useState('')
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [workingDays, setWorkingDays] = useState(26)

  async function fetchEmployees() {
    if (!month) return
    setLoading(true)

    const { data: emps } = await supabase
      .from('employees')
      .select('id, employee_code, first_name, last_name, designation, client_sites(site_name, state_code)')
      .eq('status', 'active')
      .order('employee_code')

    const { data: att } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_month', month + '-01')

    const attMap = {}
    if (att) {
      att.forEach(a => { attMap[a.employee_id] = a })
    }

    const attState = {}
    if (emps) {
      emps.forEach(emp => {
        attState[emp.id] = attMap[emp.id] || {
          working_days: workingDays,
          present_days: workingDays,
          absent_days: 0,
          lop_days: 0,
          overtime_hours: 0,
          remarks: '',
        }
      })
    }

    setEmployees(emps || [])
    setAttendance(attState)
    setLoading(false)
  }

  function handleChange(empId, field, value) {
    const current = { ...attendance[empId] }
    current[field] = Number(value) || 0

    if (field === 'present_days') {
      current.absent_days = Math.max(0, current.working_days - current.present_days)
      current.lop_days = Math.max(0, current.working_days - current.present_days)
    }
    if (field === 'lop_days') {
      current.present_days = Math.max(0, current.working_days - current.lop_days)
      current.absent_days = current.lop_days
    }
    if (field === 'working_days') {
      current.absent_days = Math.max(0, current.working_days - current.present_days)
      current.lop_days = current.absent_days
    }

    setAttendance({ ...attendance, [empId]: current })
  }

  async function handleSave() {
    if (!month || employees.length === 0) return
    setSaving(true)

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    for (const emp of employees) {
      const att = attendance[emp.id]
      if (!att) continue

      await supabase
        .from('attendance')
        .upsert({
          company_id: company?.id,
          employee_id: emp.id,
          attendance_month: month + '-01',
          working_days: att.working_days,
          present_days: att.present_days,
          absent_days: att.absent_days,
          lop_days: att.lop_days,
          overtime_hours: att.overtime_hours || 0,
          remarks: att.remarks || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,attendance_month' })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const totalLOP = Object.values(attendance).reduce((s, a) => s + (a.lop_days || 0), 0)
  const totalOT = Object.values(attendance).reduce((s, a) => s + (a.overtime_hours || 0), 0)

  return (
    <div>
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Attendance Month *</label>
            <input type="month" value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Working Days</label>
            <input type="number" value={workingDays}
              onChange={e => setWorkingDays(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1" max="31" />
          </div>
          <div className="mt-5">
            <button onClick={fetchEmployees} disabled={!month || loading}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Loading...' : '📅 Load Employees'}
            </button>
          </div>
        </div>
      </div>

      {employees.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-900">{employees.length}</p>
              <p className="text-xs text-blue-600">Total Employees</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{totalLOP}</p>
              <p className="text-xs text-red-600">Total LOP Days</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{totalOT}</p>
              <p className="text-xs text-green-600">Total OT Hours</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="px-3 py-3 text-left">Emp Code</th>
                    <th className="px-3 py-3 text-left">Name</th>
                    <th className="px-3 py-3 text-left">Site</th>
                    <th className="px-3 py-3 text-center">Working Days</th>
                    <th className="px-3 py-3 text-center">Present</th>
                    <th className="px-3 py-3 text-center">LOP Days</th>
                    <th className="px-3 py-3 text-center">OT Hours</th>
                    <th className="px-3 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => {
                    const att = attendance[emp.id] || {}
                    const hasLOP = att.lop_days > 0
                    return (
                      <tr key={emp.id}
                        className={`border-b ${hasLOP ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{emp.employee_code}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{emp.first_name} {emp.last_name || ''}</p>
                          <p className="text-xs text-gray-400">{emp.designation || '—'}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {emp.client_sites?.state_code || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number"
                            value={att.working_days || workingDays}
                            onChange={e => handleChange(emp.id, 'working_days', e.target.value)}
                            className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-center"
                            min="0" max="31" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number"
                            value={att.present_days ?? workingDays}
                            onChange={e => handleChange(emp.id, 'present_days', e.target.value)}
                            className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-center"
                            min="0" max="31" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number"
                            value={att.lop_days || 0}
                            onChange={e => handleChange(emp.id, 'lop_days', e.target.value)}
                            className={`w-14 border rounded px-2 py-1 text-xs text-center
                              ${hasLOP ? 'border-red-400 bg-red-50 text-red-600 font-bold' : 'border-gray-300'}`}
                            min="0" max="31" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number"
                            value={att.overtime_hours || 0}
                            onChange={e => handleChange(emp.id, 'overtime_hours', e.target.value)}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center"
                            min="0" step="0.5" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text"
                            value={att.remarks || ''}
                            onChange={e => setAttendance({
                              ...attendance,
                              [emp.id]: { ...att, remarks: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                            placeholder="Optional..." />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-green-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save Attendance'}
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">✅ Attendance saved!</span>}
          </div>
        </>
      )}

      {employees.length === 0 && month && !loading && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400">No active employees found.</p>
        </div>
      )}
    </div>
  )
}

function MonthlySummary() {
  const [month, setMonth] = useState('')
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchSummary() {
    if (!month) return
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, employees(employee_code, first_name, last_name, designation, client_sites(site_name, state_code))')
      .eq('attendance_month', month + '-01')
      .order('created_at')
    if (data) setSummary(data)
    setLoading(false)
  }

  const totalPresent = summary.reduce((s, a) => s + Number(a.present_days), 0)
  const totalLOP = summary.reduce((s, a) => s + Number(a.lop_days), 0)
  const totalOT = summary.reduce((s, a) => s + Number(a.overtime_hours), 0)
  const lopEmployees = summary.filter(a => a.lop_days > 0).length

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Select Month</label>
          <input type="month" value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="mt-5">
          <button onClick={fetchSummary} disabled={!month || loading}
            className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
            {loading ? 'Loading...' : 'Load Summary'}
          </button>
        </div>
      </div>

      {summary.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Employees', value: summary.length, color: 'text-blue-900' },
              { label: 'Total Present Days', value: totalPresent, color: 'text-green-600' },
              { label: 'Total LOP Days', value: totalLOP, color: 'text-red-500' },
              { label: 'Employees with LOP', value: lopEmployees, color: 'text-orange-500' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Site</th>
                    <th className="px-4 py-3 text-center">Working</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">LOP</th>
                    <th className="px-4 py-3 text-center">OT Hrs</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((a, i) => (
                    <tr key={a.id}
                      className={`border-b ${a.lop_days > 0 ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{a.employees?.first_name} {a.employees?.last_name || ''}</p>
                        <p className="text-xs text-gray-400">{a.employees?.employee_code}</p>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {a.employees?.client_sites?.state_code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">{a.working_days}</td>
                      <td className="px-4 py-2 text-center text-green-600 font-medium">{a.present_days}</td>
                      <td className="px-4 py-2 text-center">
                        {a.lop_days > 0
                          ? <span className="text-red-500 font-bold">{a.lop_days}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500">{a.overtime_hours || 0}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{a.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LOPRegister() {
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [lopData, setLopData] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchLOP() {
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, employees(employee_code, first_name, last_name, designation)')
      .gt('lop_days', 0)
      .gte('attendance_month', `${year}-01-01`)
      .lte('attendance_month', `${year}-12-31`)
      .order('attendance_month', { ascending: false })
    if (data) setLopData(data)
    setLoading(false)
  }

  useEffect(() => { fetchLOP() }, [year])

  const totalLOP = lopData.reduce((s, a) => s + Number(a.lop_days), 0)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500">
            Total LOP instances: <b className="text-red-500">{lopData.length}</b> |
            Total LOP days: <b className="text-red-500">{totalLOP}</b>
          </span>
        </div>
      </div>

      {loading ? <p className="text-gray-400">Loading...</p> : lopData.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400">No LOP records found for {year}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-center">Working Days</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">LOP Days</th>
                <th className="px-4 py-3 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {lopData.map((a, i) => (
                <tr key={a.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-red-50'}`}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{a.employees?.first_name} {a.employees?.last_name || ''}</p>
                    <p className="text-xs text-gray-400">{a.employees?.employee_code} | {a.employees?.designation || '—'}</p>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(a.attendance_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2 text-center">{a.working_days}</td>
                  <td className="px-4 py-2 text-center text-green-600">{a.present_days}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded text-xs">
                      {a.lop_days} days
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{a.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Attendance
