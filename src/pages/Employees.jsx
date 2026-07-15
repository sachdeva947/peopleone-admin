import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ───────────────────────────────────────────────
const MANDATORY_DOCS = [
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
  'PAN_CARD',
  'PHOTO',
  'CANCELLED_CHEQUE',
]

const DOC_LABELS = {
  AADHAAR_FRONT:    'Aadhaar Front',
  AADHAAR_BACK:     'Aadhaar Back',
  PAN_CARD:         'PAN Card',
  PHOTO:            'Passport Photo',
  CANCELLED_CHEQUE: 'Cancelled Cheque',
  OFFER_LETTER:     'Offer Letter',
  EXPERIENCE_LETTER:'Experience Letter',
  DEGREE_CERTIFICATE:'Degree Certificate',
  OTHER:            'Other',
}

const STATUS_COLORS = {
  active:     'bg-green-100 text-green-800',
  onboarding: 'bg-yellow-100 text-yellow-800',
  inactive:   'bg-red-100 text-red-800',
  terminated: 'bg-gray-100 text-gray-700',
}

// ─── Main Component ───────────────────────────────────────────
export default function Employees() {
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState('all')
  const [selected, setSelected]     = useState(null)   // employee for DocumentModal
  const [showAdd, setShowAdd]       = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    setLoading(true)
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setEmployees(data || [])
    setLoading(false)
  }

  const filtered = employees.filter(e => {
    const matchSearch =
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, code, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={filterStatus}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
        <button
          onClick={fetchEmployees}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No employees found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Code', 'Name', 'Designation', 'Department', 'DOJ', 'Status', 'Documents', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-600">{emp.employee_code || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.designation || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.date_of_joining || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status] || 'bg-gray-100 text-gray-600'}`}>
                      {emp.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(emp)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Docs
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(emp)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Modal */}
      {selected && (
        <DocumentModal
          employee={selected}
          onClose={() => { setSelected(null); fetchEmployees() }}
        />
      )}
    </div>
  )
}

// ─── Document Modal ───────────────────────────────────────────
function DocumentModal({ employee, onClose }) {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('AADHAAR_FRONT')

  useEffect(() => {
    fetchDocs()
  }, [])

  async function fetchDocs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
    if (!error) setDocs(data || [])
    setLoading(false)
  }

  // ── Upload ────────────────────────────────────────────────
  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${employee.id}/${selectedType}_${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('employee-documents')
      .upload(path, file)

    if (upErr) {
      alert('Upload failed: ' + upErr.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(path)

    await supabase.from('employee_documents').insert({
      employee_id:         employee.id,
      doc_type_code:       selectedType,
      doc_label:           DOC_LABELS[selectedType],
      file_url:            urlData.publicUrl,
      verification_status: 'pending',
    })

    setUploading(false)
    fetchDocs()
  }

  // ── Verify / Reject ───────────────────────────────────────
  async function updateDocStatus(docId, status) {
    await supabase
      .from('employee_documents')
      .update({ verification_status: status, verified_at: new Date().toISOString() })
      .eq('id', docId)
    await fetchDocs()
    await checkAllVerified()
  }

  // ── Activate Portal ───────────────────────────────────────
  async function activatePortal() {
    // Check if portal user already exists
    const { data: existing } = await supabase
      .from('employee_portal_users')
      .select('id')
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (existing) {
      // Just re-activate
      await supabase
        .from('employee_portal_users')
        .update({ is_active: true })
        .eq('employee_id', employee.id)
    } else {
      // Create portal user
      const tempPassword = Math.random().toString(36).slice(-8)
      await supabase.from('employee_portal_users').insert({
        employee_id: employee.id,
        email:       employee.email,
        password:    tempPassword,
        is_active:   true,
      })
    }

    // Mark employee active
    await supabase
      .from('employees')
      .update({ status: 'active' })
      .eq('id', employee.id)

    alert('✅ Portal activated! Employee status set to Active.')
    fetchDocs()
  }

  // ── Check All Verified ────────────────────────────────────
  async function checkAllVerified() {
    const { data } = await supabase
      .from('employee_documents')
      .select('doc_type_code, verification_status')
      .eq('employee_id', employee.id)
      .in('doc_type_code', MANDATORY_DOCS)

    if (!data) return

    // If any mandatory doc is rejected → deactivate
    const anyRejected = data.some(d => d.verification_status === 'rejected')
    if (anyRejected) {
      await supabase
        .from('employee_portal_users')
        .update({ is_active: false })
        .eq('employee_id', employee.id)
      await supabase
        .from('employees')
        .update({ status: 'onboarding' })
        .eq('id', employee.id)
      alert('⚠️ Document rejected — portal deactivated. Employee moved to Onboarding.')
      fetchDocs()
      return
    }

    // If all mandatory docs are verified → activate
    const allVerified = MANDATORY_DOCS.every(code =>
      data.some(d => d.doc_type_code === code && d.verification_status === 'verified')
    )

    if (allVerified) {
      await activatePortal()
    }
  }

  // ── Render ────────────────────────────────────────────────
  const mandatoryStatus = MANDATORY_DOCS.map(code => {
    const doc = docs.find(d => d.doc_type_code === code)
    return { code, label: DOC_LABELS[code], doc }
  })

  const otherDocs = docs.filter(d => !MANDATORY_DOCS.includes(d.doc_type_code))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Document Vault</h2>
            <p className="text-sm text-gray-500">{employee.name} · {employee.employee_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[employee.status] || 'bg-gray-100 text-gray-600'}`}>
              {employee.status}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Upload Section */}
          <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-300">
            <p className="text-sm font-semibold text-gray-700 mb-3">Upload New Document</p>
            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(DOC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
              <span className="text-xs text-gray-400">PDF, JPG, PNG accepted</span>
            </div>
          </div>

          {/* Mandatory Documents */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Mandatory Documents
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({mandatoryStatus.filter(m => m.doc?.verification_status === 'verified').length}/{MANDATORY_DOCS.length} verified)
              </span>
            </p>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
            ) : (
              <div className="space-y-2">
                {mandatoryStatus.map(({ code, label, doc }) => (
                  <DocRow
                    key={code}
                    label={label}
                    doc={doc}
                    onVerify={() => updateDocStatus(doc.id, 'verified')}
                    onReject={() => updateDocStatus(doc.id, 'rejected')}
                    onPending={() => updateDocStatus(doc.id, 'pending')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Other Documents */}
          {otherDocs.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Other Documents</p>
              <div className="space-y-2">
                {otherDocs.map(doc => (
                  <DocRow
                    key={doc.id}
                    label={DOC_LABELS[doc.doc_type_code] || doc.doc_label || doc.doc_type_code}
                    doc={doc}
                    onVerify={() => updateDocStatus(doc.id, 'verified')}
                    onReject={() => updateDocStatus(doc.id, 'rejected')}
                    onPending={() => updateDocStatus(doc.id, 'pending')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Manual Activate Button */}
          {employee.status !== 'active' && (
            <div className="border-t pt-4">
              <button
                onClick={activatePortal}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                ✅ Manually Activate Portal
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Use only if all documents are manually verified outside the system.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Doc Row ──────────────────────────────────────────────────
function DocRow({ label, doc, onVerify, onReject, onPending }) {
  const statusConfig = {
    verified: { bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-800',  icon: '✅' },
    rejected: { bg: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-800',      icon: '❌' },
    pending:  { bg: 'bg-yellow-50 border-yellow-200',badge: 'bg-yellow-100 text-yellow-800',icon: '⏳' },
  }

  const cfg = doc ? (statusConfig[doc.verification_status] || statusConfig.pending) : null

  if (!doc) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-gray-300">📄</span>
          <span className="text-sm text-gray-500">{label}</span>
        </div>
        <span className="text-xs text-gray-400 italic">Not uploaded</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${cfg.bg}`}>
      <div className="flex items-center gap-2">
        <span>{cfg.icon}</span>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
          {doc.verification_status}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* View */}
        <a
          href={doc.file_url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline text-xs"
        >
          View
        </a>

        {/* Action buttons */}
        {doc.verification_status !== 'verified' && (
          <button
            onClick={onVerify}
            className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
          >
            Verify
          </button>
        )}
        {doc.verification_status !== 'rejected' && (
          <button
            onClick={onReject}
            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
          >
            Reject
          </button>
        )}
        {doc.verification_status !== 'pending' && (
          <button
            onClick={onPending}
            className="bg-gray-400 text-white px-2 py-1 rounded text-xs hover:bg-gray-500"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
