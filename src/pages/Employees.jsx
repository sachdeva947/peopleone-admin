import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generateOfferLetter } from '../lib/offerLetter'  

function Employees() {
  const [view, setView] = useState('list') // 'list' | 'add'
  const [selectedEmp, setSelectedEmp] = useState(null)
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
  }async function sendOnboardingLink(emp) {
    // Generate token
    const token = crypto.randomUUID()
    
    // Save token to employee
    await supabase
      .from('employees')
      .update({ 
        onboarding_token: token,
        onboarding_link_sent_at: new Date().toISOString()
      })
      .eq('id', emp.id)

    // Call edge function
    const { data, error } = await supabase.functions.invoke('send-onboarding-email', {
      body: {
        employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        employee_email: emp.personal_email,
        onboarding_token: token,
      }
    })

    if (error) {
      alert('Error sending email: ' + error.message)
    } else {
      alert(`✅ Onboarding link sent to ${emp.personal_email}!`)
      fetchEmployees()
    }
  }{selectedEmp && (
  <DocumentModal
    employee={selectedEmp}
    onClose={() => setSelectedEmp(null)}
  />
)}

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
  onSendLink={sendOnboardingLink}
  onOfferLetter={generateOffer}
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
async function generateOffer(emp) {
  const { data: salary } = await supabase
    .from('employee_salary')
    .select('*')
    .eq('employee_id', emp.id)
    .is('effective_to', null)
    .single()

  const { data: site } = await supabase
    .from('client_sites')
    .select('site_name, state_code')
    .eq('id', emp.current_site_id)
    .single()

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .limit(1)
    .single()

  const empWithSite = { ...emp, site_name: site?.site_name }
  generateOfferLetter(empWithSite, salary, company)
}
// ── EMPLOYEE LIST ─────────────────────────────────────────────
function EmployeeList({ employees, loading, onAdd, onSendLink, onOfferLetter }) {
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
              <th className="px-4 py-3 text-center">Offer Letter</th>
              <th className="px-4 py-3 text-center">Documents</th>
              <th className="px-4 py-3 text-left">Onboarding</th>
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
      <div className="flex flex-col gap-1">
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize w-fit ${statusColor[emp.status] || 'bg-gray-100 text-gray-600'}`}>
          {emp.status}
        </span>
        {emp.onboarding_link_sent_at && (
          <span className="text-green-600 text-xs">✅ Sent</span>
        )}
        {emp.status === 'onboarding' && (
          <button
            onClick={() => onSendLink(emp)}
            className="bg-blue-900 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-800 transition w-fit"
          >
            📧 Send Link
          </button>
        )}
      </div>
    </td>
    <td className="px-4 py-3 text-center">
      <button
        onClick={() => onOfferLetter(emp)}
        className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 transition"
      >
        📄 Offer
      </button>
    </td>
    <td className="px-4 py-3 text-center">
      <button
        onClick={() => setSelectedEmp(emp)}
        className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 transition"
      >
        📁 Docs
      </button>
    </td>
  </tr>
))}
        
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
function DocumentModal({ employee, onClose }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    fetchDocs()
  }, [employee.id])

  async function fetchDocs() {
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employee.id)
      .order('uploaded_at', { ascending: false })
    if (data) setDocs(data)
    setLoading(false)
  }

  async function updateStatus(docId, status, reason = '') {
    setUpdating(docId)
    await supabase
      .from('employee_documents')
      .update({
        verification_status: status,
        verified: status === 'verified',
        rejection_reason: reason || null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', docId)
    setUpdating(null)
    fetchDocs()

    // Check if all mandatory docs verified
    if (status === 'verified') {
      await checkAllVerified()
    }
  }

  async function checkAllVerified() {
    const mandatoryDocs = ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'PHOTO', 'CANCELLED_CHEQUE']
    const { data } = await supabase
      .from('employee_documents')
      .select('doc_type_code, verification_status')
      .eq('employee_id', employee.id)
      .in('doc_type_code', mandatoryDocs)

    const allVerified = mandatoryDocs.every(code =>
      data?.some(d => d.doc_type_code === code && d.verification_status === 'verified')
    )

    if (allVerified) {
      // Send welcome email + activate portal
      await activatePortal()
    }
  }

  async function activatePortal() {
    // Generate reset token
    const resetToken = crypto.randomUUID()
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Create portal user
    await supabase.from('employee_portal_users').upsert({
      employee_id: employee.id,
      email: employee.personal_email,
      is_active: true,
      first_login: true,
      reset_token: resetToken,
      reset_token_expiry: expiry,
    }, { onConflict: 'employee_id' })

    // Send welcome email
    await supabase.functions.invoke('send-welcome-email', {
      body: {
        employee_name: `${employee.first_name} ${employee.last_name || ''}`.trim(),
        employee_email: employee.personal_email,
        employee_code: employee.employee_code,
        reset_token: resetToken,
        portal_url: 'https://peopleone-employee.vercel.app',
      }
    })

    alert(`✅ All documents verified! Welcome email sent to ${employee.personal_email}`)
  }

  async function getFileUrl(filePath) {
    const { data } = await supabase.storage
      .from('employee-documents')
      .createSignedUrl(filePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const statusColor = {
    pending:  'bg-yellow-100 text-yellow-700',
    verified: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  const mandatoryDocs = ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'PHOTO', 'CANCELLED_CHEQUE']
  const allMandatoryVerified = mandatoryDocs.every(code =>
    docs.some(d => d.doc_type_code === code && d.verification_status === 'verified')
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-blue-900 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {employee.first_name} {employee.last_name || ''} — Documents
            </h3>
            <p className="text-blue-300 text-xs">{employee.employee_code}</p>
          </div>
          <div className="flex items-center gap-3">
            {allMandatoryVerified && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                ✅ All Verified
              </span>
            )}
            <button onClick={onClose} className="text-white hover:text-gray-300 text-xl">✕</button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading documents...</p>
          ) : docs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-5xl mb-3">📁</p>
              <p className="text-gray-400">No documents uploaded yet.</p>
              <p className="text-gray-300 text-sm mt-1">
                Employee needs to complete onboarding first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map(doc => (
                <div key={doc.id}
                  className={`border rounded-xl p-4 ${
                    doc.verification_status === 'verified' ? 'border-green-200 bg-green-50' :
                    doc.verification_status === 'rejected' ? 'border-red-200 bg-red-50' :
                    'border-gray-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-700">{doc.doc_name}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[doc.verification_status] || 'bg-gray-100 text-gray-600'}`}>
                          {doc.verification_status}
                        </span>
                        {mandatoryDocs.includes(doc.doc_type_code) && (
                          <span className="text-red-400 text-xs">*mandatory</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {doc.file_name} • {doc.file_size_kb}KB
                        {doc.uploaded_at && ` • ${new Date(doc.uploaded_at).toLocaleDateString('en-IN')}`}
                      </p>
                      {doc.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">Reason: {doc.rejection_reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* View button */}
                      {doc.file_url && (
                        <button
                          onClick={() => getFileUrl(doc.file_url)}
                          className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-200">
                          👁️ View
                        </button>
                      )}

                      {/* Verify button */}
                      {doc.verification_status !== 'verified' && (
                        <button
                          onClick={() => updateStatus(doc.id, 'verified')}
                          disabled={updating === doc.id}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50">
                          {updating === doc.id ? '...' : '✅ Verify'}
                        </button>
                      )}

                      {/* Reject button */}
                      {doc.verification_status !== 'rejected' && (
                        <button
                          onClick={async () => {
                            const reason = prompt('Rejection reason:')
                            if (reason !== null) {
                              await updateStatus(doc.id, 'rejected', reason)
                            }
                          }}
                          disabled={updating === doc.id}
                          className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200 disabled:opacity-50">
                          ❌ Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {docs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex gap-4 text-sm">
                <span className="text-yellow-600">
                  ⏳ Pending: {docs.filter(d => d.verification_status === 'pending').length}
                </span>
                <span className="text-green-600">
                  ✅ Verified: {docs.filter(d => d.verification_status === 'verified').length}
                </span>
                <span className="text-red-500">
                  ❌ Rejected: {docs.filter(d => d.verification_status === 'rejected').length}
                </span>
              </div>
              {!allMandatoryVerified && (
                <p className="text-xs text-orange-500 mt-2">
                  ⚠️ All 5 mandatory documents must be verified to activate employee portal.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Employees