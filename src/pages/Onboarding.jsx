import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Onboard() {
  const { token } = useParams()
  const [step, setStep] = useState(1)
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [sameAddress, setSameAddress] = useState(false)

  const mandatoryDocs = ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'PHOTO', 'CANCELLED_CHEQUE']
  const allMandatoryUploaded = mandatoryDocs.every(code => uploadedDocs.includes(code))

  const [form, setForm] = useState({
    father_name: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    work_experience: '',
    permanent_address: '',
    current_address: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_account_type: 'savings',
    pan: '',
    aadhaar_last4: '',
  })

  useEffect(() => {
    async function fetchEmployee() {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('onboarding_token', token)
        .single()

      if (error || !data) {
        setError('Invalid or expired onboarding link.')
      } else if (data.onboarding_completed_at) {
        setError('Onboarding already completed!')
      } else {
        setEmployee(data)
        setForm(prev => ({
          ...prev,
          father_name:      data.father_name || '',
          date_of_birth:    data.date_of_birth || '',
          gender:           data.gender || '',
          pan:              data.pan || '',
          aadhaar_last4:    data.aadhaar_last4 || '',
          bank_name:        data.bank_name || '',
          bank_account_no:  data.bank_account_no || '',
          bank_ifsc:        data.bank_ifsc || '',
          blood_group:      data.blood_group || '',
          work_experience:  data.work_experience || '',
          permanent_address: data.permanent_address || '',
          current_address:  data.current_address || '',
        }))
      }
      setLoading(false)
    }
    fetchEmployee()
  }, [token])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'permanent_address' && sameAddress) {
        updated.current_address = value
      }
      return updated
    })
  }

  function handleSameAddress(e) {
    const checked = e.target.checked
    setSameAddress(checked)
    if (checked) {
      setForm(prev => ({ ...prev, current_address: prev.permanent_address }))
    }
  }

  function validateStep1() {
    if (!form.father_name) { alert('Father name is required!'); return false }
    if (!form.date_of_birth) { alert('Date of birth is required!'); return false }
    if (!form.gender) { alert('Gender is required!'); return false }
    if (!form.permanent_address) { alert('Permanent address is required!'); return false }
    if (!form.current_address) { alert('Current address is required!'); return false }
    return true
  }

  function validateStep3() {
    if (!form.bank_name) { alert('Bank name is required!'); return false }
    if (!form.bank_account_no) { alert('Account number is required!'); return false }
    if (!form.bank_ifsc) { alert('IFSC code is required!'); return false }
    return true
  }

  async function handleSubmit() {
    if (!validateStep3()) return
    setSaving(true)
    const { error } = await supabase
      .from('employees')
      .update({
        ...form,
        onboarding_completed_at: new Date().toISOString(),
        status: 'active',
        onboarding_token: null,
      })
      .eq('id', employee.id)

    setSaving(false)
    if (!error) setStep(4)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const inputClassPrefilled = "w-full border border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-lg">Loading...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow p-10 text-center max-w-md">
        <p className="text-5xl mb-4">❌</p>
        <p className="text-red-600 font-medium text-lg">{error}</p>
        <p className="text-gray-400 text-sm mt-2">Please contact your HR team.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-5 px-6 text-center">
        <h1 className="text-2xl font-bold">PeopleOne</h1>
        <p className="text-blue-300 text-sm">Employee Onboarding</p>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">

        {step !== 4 && (
          <div className="bg-white rounded-2xl shadow p-5 mb-6 text-center">
            <p className="text-gray-500 text-sm">Welcome,</p>
            <p className="text-xl font-bold text-blue-900">
              {employee.first_name} {employee.last_name || ''}
            </p>
            <p className="text-gray-400 text-sm">{employee.designation}</p>
          </div>
        )}

        {step !== 4 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${step === s ? 'bg-blue-900 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && <div className={`w-8 h-1 rounded ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — Personal Details */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-1">Personal Details</h2>
            <p className="text-xs text-blue-600 mb-4">
              💡 Fields pre-filled from your records — please verify and update if needed.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Father's Name <span className="text-red-500">*</span>
                </label>
                <input name="father_name" value={form.father_name} onChange={handleChange}
                  className={form.father_name ? inputClassPrefilled : inputClass}
                  placeholder="Ram Kumar" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange}
                  className={form.date_of_birth ? inputClassPrefilled : inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select name="gender" value={form.gender} onChange={handleChange}
                  className={form.gender ? inputClassPrefilled : inputClass}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Blood Group</label>
                <select name="blood_group" value={form.blood_group} onChange={handleChange}
                  className={form.blood_group ? inputClassPrefilled : inputClass}>
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Work Experience</label>
                <input name="work_experience" value={form.work_experience} onChange={handleChange}
                  className={form.work_experience ? inputClassPrefilled : inputClass}
                  placeholder="e.g. 2 Years" />
              </div>

              {/* Permanent Address */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Permanent Address <span className="text-red-500">*</span>
                </label>
                <textarea name="permanent_address" value={form.permanent_address} onChange={handleChange}
                  rows={3}
                  className={form.permanent_address ? inputClassPrefilled : inputClass}
                  placeholder="Full permanent address..." />
              </div>

              {/* Current Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-600">
                    Current Address <span className="text-red-500">*</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-blue-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAddress}
                      onChange={handleSameAddress}
                      className="rounded"
                    />
                    Same as permanent address
                  </label>
                </div>
                <textarea name="current_address" value={form.current_address} onChange={handleChange}
                  rows={3}
                  disabled={sameAddress}
                  className={`${form.current_address ? inputClassPrefilled : inputClass} ${sameAddress ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="Current address (if different)..." />
              </div>
            </div>
            <button onClick={() => { if (validateStep1()) setStep(2) }}
              className="w-full mt-6 bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition">
              Next →
            </button>
          </div>
        )}

        {/* Step 2 — Documents */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-1">Upload Documents</h2>
            <p className="text-gray-400 text-xs mb-1">
              Upload clear photos/scans. Accepted: JPG, PNG, PDF. Max 5MB each.
            </p>
            <p className="text-red-500 text-xs mb-4">
              * All 5 mandatory documents must be uploaded to proceed.
            </p>

            <div className="space-y-3">
              {[
                { code: 'AADHAAR_FRONT',    label: 'Aadhaar Card (Front)',   mandatory: true },
                { code: 'AADHAAR_BACK',     label: 'Aadhaar Card (Back)',    mandatory: true },
                { code: 'PAN_CARD',         label: 'PAN Card',               mandatory: true },
                { code: 'PHOTO',            label: 'Passport Size Photo',    mandatory: true },
                { code: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque',       mandatory: true },
                { code: '10TH_CERT',        label: '10th Certificate',       mandatory: false },
                { code: '12TH_CERT',        label: '12th Certificate',       mandatory: false },
                { code: 'GRADUATION',       label: 'Graduation Certificate', mandatory: false },
                { code: 'EXPERIENCE',       label: 'Experience Letter',      mandatory: false },
                { code: 'RELIEVING',        label: 'Relieving Letter',       mandatory: false },
              ].map(doc => (
                <DocumentUploadRow
                  key={doc.code}
                  doc={doc}
                  employeeId={employee.id}
                  onUploaded={(code) => setUploadedDocs(prev =>
                    prev.includes(code) ? prev : [...prev, code]
                  )}
                />
              ))}
            </div>

            {/* Mandatory progress */}
            <div className="mt-4 bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2">Mandatory documents uploaded:</p>
              <div className="flex gap-2 flex-wrap">
                {mandatoryDocs.map(code => (
                  <span key={code}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      uploadedDocs.includes(code)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                    {uploadedDocs.includes(code) ? '✓' : '○'} {code.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-lg font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              <button
                onClick={() => {
                  if (!allMandatoryUploaded) {
                    alert('Please upload all 5 mandatory documents before proceeding!\n\nMissing: ' +
                      mandatoryDocs.filter(c => !uploadedDocs.includes(c)).join(', '))
                    return
                  }
                  setStep(3)
                }}
                className={`flex-1 py-3 rounded-lg font-medium transition
                  ${allMandatoryUploaded
                    ? 'bg-blue-900 text-white hover:bg-blue-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Bank Details */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-1">Bank Details</h2>
            <p className="text-xs text-blue-600 mb-4">
              💡 Pre-filled from your records — please verify carefully.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input name="bank_name" value={form.bank_name} onChange={handleChange}
                  className={form.bank_name ? inputClassPrefilled : inputClass}
                  placeholder="State Bank of India" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input name="bank_account_no" value={form.bank_account_no} onChange={handleChange}
                  className={form.bank_account_no ? inputClassPrefilled : inputClass}
                  placeholder="12345678901" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input name="bank_ifsc" value={form.bank_ifsc} onChange={handleChange}
                  className={form.bank_ifsc ? inputClassPrefilled : inputClass}
                  placeholder="SBIN0001234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Account Type</label>
                <select name="bank_account_type" value={form.bank_account_type} onChange={handleChange}
                  className={inputClass}>
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                </select>
              </div>

              {/* PAN verification */}
              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-gray-500 mb-3">Identity verification</p>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">PAN Number</label>
                  <input name="pan" value={form.pan} onChange={handleChange}
                    className={form.pan ? inputClassPrefilled : inputClass}
                    placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Aadhaar Last 4 Digits</label>
                  <input name="aadhaar_last4" value={form.aadhaar_last4} onChange={handleChange}
                    className={form.aadhaar_last4 ? inputClassPrefilled : inputClass}
                    placeholder="1234" maxLength={4} />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <p className="text-yellow-700 text-xs font-medium">⚠️ Please verify bank details carefully.</p>
              <p className="text-yellow-600 text-xs mt-0.5">Incorrect details may delay salary credit.</p>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-lg font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50">
                {saving ? 'Submitting...' : '✅ Submit'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div className="bg-white rounded-2xl shadow p-10 text-center">
            <p className="text-6xl mb-4">🎉</p>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Onboarding Complete!</h2>
            <p className="text-gray-500">
              Thank you {employee.first_name}! Your details have been submitted successfully.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              HR team will verify your documents and activate your account.
              You will receive a welcome email with portal access details.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentUploadRow({ doc, employeeId, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large! Max 5MB allowed.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const ext = file.name.split('.').pop()
      const filePath = `${employeeId}/${doc.code}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      await supabase.from('employee_documents').insert({
        employee_id: employeeId,
        doc_type: doc.code,
        doc_type_code: doc.code,
        doc_name: doc.label,
        file_name: file.name,
        file_url: filePath,
        file_size_kb: Math.round(file.size / 1024),
        uploaded_by: 'employee',
        verified: false,
        verification_status: 'pending',
      })

      setUploaded(true)
      setFileName(file.name)
      onUploaded(doc.code)
    } catch (err) {
      setError('Upload failed. Please try again.')
      console.error(err)
    }
    setUploading(false)
  }

  return (
    <div className={`border rounded-xl p-4 transition ${
      uploaded
        ? 'border-green-300 bg-green-50'
        : doc.mandatory
          ? 'border-gray-200'
          : 'border-dashed border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">
            {doc.label}
            {doc.mandatory && <span className="text-red-500 ml-1">*</span>}
            {!doc.mandatory && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
          </p>
          {uploaded && (
            <p className="text-xs text-green-600 mt-0.5">✅ {fileName}</p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-0.5">❌ {error}</p>
          )}
        </div>
        <div>
          {uploaded ? (
            <label className="cursor-pointer text-xs text-blue-600 hover:underline">
              Re-upload
              <input type="file" accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleUpload} className="hidden" />
            </label>
          ) : (
            <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white
              ${uploading ? 'bg-gray-400' : 'bg-blue-900 hover:bg-blue-800'}`}>
              {uploading ? 'Uploading...' : '📎 Upload'}
              <input type="file" accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}

export default Onboard
