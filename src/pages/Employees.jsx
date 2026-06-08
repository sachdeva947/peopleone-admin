import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Employees() {
  const [view, setView] = useState('list') // 'list' | 'add'
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEmployees() }, [])

  async function fetchEmployees() {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*, client_sites(site_name, state_code)')
      .order('created_at', { ascending: false })
    if (data) setEmployees(data)
    setLoading(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-700">
          Employees {!loading && `(${employees.length})`}
        </h2>
        <button
          onClick={() => setView(view === 'list' ? 'add' : 'list')}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
        >
          {view === 'list' ? '+ Add Employee' : '← Back to List'}
        </button>
      </div>

      {view === 'list' && (
        <EmployeeList
          employees={employees}
          loading={loading}
          onAdd={() => setView('add')}
        />
      )}
      {view === 'add' && (
        <AddEmployee
          onSuccess={() => { setView('list'); fetchEmployees() }}
        />
      )}
    </div>
  )
}

// ── EMPLOYEE LIST ─────────────────────────────────────────────
function EmployeeList({ employees, loading, onAdd }) {
  if (loading) return <p className="text-gray-400">Loading...</p>

  if (employees.length === 0) return (
    <div className="bg-white rounded-2xl shadow p-12 text-center">
      <p className="text-5xl mb-4">👥</p>
      <p className="text-gray-500 text-lg mb-4">No employees yet</p>
      <button
        onClick={onAdd}
        className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
      >
        + Add First Employee
      </button>
    </div>
  )

  const statusColor = {
    active:      'bg-green-100 text-green-700',
    onboarding:  'bg-yellow-100 text-yellow-700',
    resigned:    'bg-red-100 text-red-700',
    terminated:  'bg-red-100 text-red-700',
    absconded:   'bg-gray-100 text-gray-600',
  }

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="px-4 py-3 text-left">Emp Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Designation</th>
              <th className="px-4 py-3 text-left">Site</th>
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-left">Joining</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{emp.employee_code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {emp.first_name} {emp.last_name || ''}
                </td>
                <td className="px-4 py-3 text-gray-500">{emp.designation || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{emp.client_sites?.site_name || '—'}</td>
                <td className="px-4 py-3">
                  {emp.client_sites?.state_code
                    ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{emp.client_sites.state_code}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor[emp.status] || 'bg-gray-100 text-gray-600'}`}>
                    {emp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── ADD EMPLOYEE FORM ─────────────────────────────────────────
function AddEmployee({ onSuccess }) {
  const [sites, setSites] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', mobile: '', personal_email: '',
    date_of_joining: '', designation: '', department: '',
    current_site_id: '', pan: '', uan_number: '',
    bank_name: '', bank_account_no: '', bank_ifsc: '',
    gender: '', date_of_birth: '', father_name: '',
  })

  useEffect(() => {
    async function fetchSites() {
      const { data } = await supabase
        .from('client_sites')
        .select('id, site_name, state_code')
        .eq('is_active', true)
        .order('site_name')
      if (data) setSites(data)
    }
    fetchSites()
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    if (!form.first_name || !form.date_of_joining) return
    setSaving(true)

    // Generate employee code
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })

    const empCode = `EMP-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    const insertData = {
      first_name: form.first_name,
      last_name: form.last_name || null,
      mobile: form.mobile || null,
      personal_email: form.personal_email || null,
      date_of_joining: form.date_of_joining,
      designation: form.designation || null,
      department: form.department || null,
      current_site_id: form.current_site_id || null,
      pan: form.pan || null,
      uan_number: form.uan_number || null,
      bank_name: form.bank_name || null,
      bank_account_no: form.bank_account_no || null,
      bank_ifsc: form.bank_ifsc || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      father_name: form.father_name || null,
      aadhaar_last4: form.aadhaar_last4 || null,
      employee_code: empCode,
      company_id: company?.id || null,
      status: 'onboarding',
    }

    const { error } = await supabase
      .from('employees')
      .insert(insertData)

    if (error) {
      console.error('Insert error:', error)
      alert('Error: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => onSuccess(), 1500)
    }
    setSaving(false)

    if (!error) {
      setSaved(true)
      setTimeout(() => onSuccess(), 1500)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="bg-white rounded-2xl shadow p-6 max-w-3xl">
      <h3 className="text-lg font-semibold text-gray-700 mb-6">Add New Employee</h3>

      {/* Personal Details */}
      <h4 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">Personal Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
          <input name="first_name" value={form.first_name} onChange={handleChange} className={inputClass} placeholder="Rajesh" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
          <input name="last_name" value={form.last_name} onChange={handleChange} className={inputClass} placeholder="Kumar" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Gender</label>
          <select name="gender" value={form.gender} onChange={handleChange} className={inputClass}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
          <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Father's Name</label>
          <input name="father_name" value={form.father_name} onChange={handleChange} className={inputClass} placeholder="Ram Kumar" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Mobile *</label>
          <input name="mobile" value={form.mobile} onChange={handleChange} className={inputClass} placeholder="9876543210" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Personal Email</label>
          <input name="personal_email" value={form.personal_email} onChange={handleChange} className={inputClass} placeholder="raj@gmail.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">PAN</label>
          <input name="pan" value={form.pan} onChange={handleChange} className={inputClass} placeholder="ABCDE1234F" />
        </div>
      </div>
      <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Aadhaar Last 4 Digits</label>
          <input
            name="aadhaar_last4"
            value={form.aadhaar_last4}
            onChange={handleChange}
            className={inputClass}
            placeholder="1234"
            maxLength={4}
          />
        </div>

      {/* Employment Details */}
      <h4 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">Employment Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Date of Joining *</label>
          <input type="date" name="date_of_joining" value={form.date_of_joining} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Designation</label>
          <input name="designation" value={form.designation} onChange={handleChange} className={inputClass} placeholder="Security Guard" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Department</label>
          <input name="department" value={form.department} onChange={handleChange} className={inputClass} placeholder="Operations" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Deployment Site</label>
          <select name="current_site_id" value={form.current_site_id} onChange={handleChange} className={inputClass}>
            <option value="">Select Site</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.site_name} ({s.state_code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">UAN Number</label>
          <input name="uan_number" value={form.uan_number} onChange={handleChange} className={inputClass} placeholder="101234567890" />
        </div>
      </div>

      {/* Bank Details */}
      <h4 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">Bank Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Bank Name</label>
          <input name="bank_name" value={form.bank_name} onChange={handleChange} className={inputClass} placeholder="State Bank of India" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Account Number</label>
          <input name="bank_account_no" value={form.bank_account_no} onChange={handleChange} className={inputClass} placeholder="12345678901" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">IFSC Code</label>
          <input name="bank_ifsc" value={form.bank_ifsc} onChange={handleChange} className={inputClass} placeholder="SBIN0001234" />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-900 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Employee'}
        </button>
        {saved && <span className="text-green-600 text-sm">✅ Employee added!</span>}
      </div>
    </div>
  )
}

export default Employees