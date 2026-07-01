import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function Onboarding() {
  const [activeTab, setActiveTab] = useState('bulk')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'bulk',  label: '📥 Bulk Import' },
          { key: 'links', label: '📧 Send Onboarding Links' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'bulk'  && <BulkImport />}
      {activeTab === 'links' && <SendLinks />}
    </div>
  )
}

// ── BULK IMPORT ───────────────────────────────────────────────
function BulkImport() {
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef()

  function downloadTemplate() {
    const headers = [
      'employee_code', 'first_name', 'last_name', 'mobile', 'personal_email',
      'date_of_joining', 'designation', 'department', 'client_site_name',
      'state_code', 'gross_monthly', 'basic_monthly', 'pan', 'uan_number',
      'bank_account_no', 'bank_ifsc', 'bank_name', 'gender', 'date_of_birth',
      'father_name', 'blood_group', 'work_experience', 'source',
      'old_uan', 'old_esic_no', 'basic', 'hra', 'special_allowance',
      'statutory_bonus'
    ]

    const sample = [
      '', 'Rajesh', 'Kumar', '9876543210', 'rajesh@gmail.com',
      '01-06-2026', 'Security Guard', 'Operations', 'Site Name Here',
      'DL', '24800', '15000', 'ABCDE1234F', '101234567890',
      '36086124317', 'SBIN0016809', 'State Bank of India', 'male', '01-01-1990',
      'Ram Kumar', 'B+', '2 Years', 'Reference',
      '', '', '15000', '5200', '3350', '1250'
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, sample])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees')
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return

    setImporting(true)
    setResults(null)
    setProgress(0)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { raw: false })

        const { data: company } = await supabase
          .from('companies').select('id').limit(1).single()

        const { data: sites } = await supabase
          .from('client_sites').select('id, site_name, state_code')

        let success = 0, failed = 0, errors = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          setProgress(Math.round(((i + 1) / rows.length) * 100))

          try {
            // Get site
            const site = sites?.find(s =>
              s.site_name?.toLowerCase() === row.client_site_name?.toLowerCase()
            )

            // Generate employee code if not provided
            const { count } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })

            const empCode = row.employee_code ||
              `EMP-${String((count || 0) + 1).padStart(4, '0')}`

            // Format date
            function parseDate(val) {
              if (!val) return null
              if (val instanceof Date) return val.toISOString().split('T')[0]
              const parts = val.toString().split(/[-\/]/)
              if (parts.length === 3) {
                if (parts[0].length === 4) return val
                return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              }
              return null
            }

            const doj = parseDate(row.date_of_joining)
            const dob = parseDate(row.date_of_birth)

            const { error, data: newEmp } = await supabase
              .from('employees')
              .insert({
                employee_code:    empCode,
                first_name:       row.first_name,
                last_name:        row.last_name || null,
                mobile:           row.mobile?.toString(),
                personal_email:   row.personal_email,
                date_of_joining:  doj,
                designation:      row.designation || null,
                department:       row.department || null,
                current_site_id:  site?.id || null,
                pan:              row.pan || null,
                uan_number:       row.uan_number || null,
                bank_account_no:  row.bank_account_no || null,
                bank_ifsc:        row.bank_ifsc || null,
                bank_name:        row.bank_name || null,
                gender:           row.gender || null,
                date_of_birth:    dob,
                father_name:      row.father_name || null,
                blood_group:      row.blood_group || null,
                work_experience:  row.work_experience || null,
                source:           row.source || null,
                old_uan:          row.old_uan || null,
                old_esic_no:      row.old_esic_no || null,
                company_id:       company?.id || null,
                status:           'onboarding',
              })
              .select('id')
              .single()

            if (error) {
              failed++
              errors.push(`Row ${i + 2}: ${row.first_name} — ${error.message}`)
              continue
            }

            // Auto salary assignment
            if (newEmp && (row.basic || row.gross_monthly)) {
              const gross = Number(row.gross_monthly) ||
                (Number(row.basic || 0) + Number(row.hra || 0) +
                 Number(row.special_allowance || 0) + Number(row.statutory_bonus || 0))

              const basic = Number(row.basic) || Math.round(gross * 0.5)
              const hra = Number(row.hra) || Math.round(basic * 0.4)
              const specialAllowance = Number(row.special_allowance) || 0
              const statutoryBonus = Number(row.statutory_bonus) || 0

              const pfEmp = Math.min(Math.round(basic * 0.12), 1800)
              const esicEmp = gross <= 21000 ? Math.round(gross * 0.0075) : 0
              const pfEr = Math.min(Math.round(basic * 0.12), 1800)
              const esicEr = gross <= 21000 ? Math.round(gross * 0.0325) : 0
              const inHand = gross - pfEmp - esicEmp

              await supabase.from('employee_salary').insert({
                employee_id:      newEmp.id,
                effective_from:   doj,
                gross_monthly:    gross,
                ctc_annual:       (gross + pfEr + esicEr) * 12,
                basic,
                hra,
                special_allowance: specialAllowance,
                statutory_bonus:  statutoryBonus,
                in_hand:          inHand,
              })
            }

            success++
          } catch (err) {
            failed++
            errors.push(`Row ${i + 2}: ${row.first_name} — ${err.message}`)
          }
        }

        setResults({ total: rows.length, success, failed, errors })
      } catch (err) {
        setResults({ total: 0, success: 0, failed: 1, errors: ['File parse error: ' + err.message] })
      }
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Bulk Employee Import</h3>
        <p className="text-sm text-gray-400 mb-6">
          Download the Excel template, fill employee details, and upload to import multiple employees at once.
        </p>

        <div className="flex flex-col gap-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-700 text-sm">Download Template</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Get the Excel template with all required columns
              </p>
              <button onClick={downloadTemplate}
                className="mt-3 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition">
                ⬇️ Download Template
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-xl">
            <div className="w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-gray-700 text-sm">Fill Employee Data</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Fill in employee details. Date format: DD-MM-YYYY
              </p>
              <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                <p>• Required: first_name, date_of_joining</p>
                <p>• client_site_name must match Settings → Client Sites exactly</p>
                <p>• state_code: DL, MH, KA, UP, etc.</p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-700 text-sm">Upload Filled File</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload the filled Excel file to import employees
              </p>
              <label className={`mt-3 inline-block px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition
                ${importing ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                {importing ? `Importing... ${progress}%` : '📤 Upload & Import'}
                <input ref={fileRef} type="file" accept=".xlsx,.xls"
                  onChange={handleImport} className="hidden" disabled={importing} />
              </label>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {importing && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Importing employees...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h4 className="font-semibold text-gray-700 mb-4">Import Results</h4>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-900">{results.total}</p>
              <p className="text-xs text-blue-600">Total Rows</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{results.success}</p>
              <p className="text-xs text-green-600">Imported</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{results.failed}</p>
              <p className="text-xs text-red-500">Failed</p>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
              <ul className="space-y-1">
                {results.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {results.success > 0 && (
            <div className="mt-3 bg-green-50 rounded-xl p-3">
              <p className="text-sm text-green-700">
                ✅ {results.success} employee(s) imported successfully!
                Go to Employees to send onboarding links.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── SEND LINKS ────────────────────────────────────────────────
function SendLinks() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState([])

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('employees')
        .select('*, employee_salary(gross_monthly), client_sites(site_name, state_code)')
        .eq('status', 'onboarding')
        .is('onboarding_link_sent_at', null)
        .order('created_at', { ascending: false })
      if (data) setEmployees(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function sendLink(emp) {
    setSending(true)
    try {
      const token = crypto.randomUUID()
      await supabase.from('employees').update({
        onboarding_token: token,
        onboarding_link_sent_at: new Date().toISOString(),
      }).eq('id', emp.id)

      const { data: company } = await supabase
        .from('companies').select('*').limit(1).single()

      await supabase.functions.invoke('send-onboarding-email', {
        body: {
          employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          employee_email: emp.personal_email,
          onboarding_token: token,
          designation: emp.designation || '',
          date_of_joining: emp.date_of_joining
            ? new Date(emp.date_of_joining).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric'
              })
            : '',
          site_name: emp.client_sites?.site_name || '',
          gross_monthly: emp.employee_salary?.[0]?.gross_monthly || '',
          onboarding_url: `https://peopleone-employee.vercel.app/onboard/${token}`,
        }
      })

      setSent(prev => [...prev, emp.id])
    } catch (err) {
      alert('Error sending link: ' + err.message)
    }
    setSending(false)
  }

  async function sendAll() {
    for (const emp of employees) {
      if (!sent.includes(emp.id)) {
        await sendLink(emp)
      }
    }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  const pending = employees.filter(e => !sent.includes(e.id))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            Send Onboarding Links
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {pending.length} employee(s) pending onboarding link
          </p>
        </div>
        {pending.length > 0 && (
          <button onClick={sendAll} disabled={sending}
            className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
            📧 Send All ({pending.length})
          </button>
        )}
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-400">All employees have been sent onboarding links!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Site</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const isSent = sent.includes(emp.id)
                return (
                  <tr key={emp.id}
                    className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      ${isSent ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{emp.first_name} {emp.last_name || ''}</p>
                      <p className="text-xs text-gray-400">{emp.employee_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{emp.designation || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.personal_email || '—'}</td>
                    <td className="px-4 py-3">
                      {emp.client_sites?.state_code && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                          {emp.client_sites.state_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSent ? (
                        <span className="text-green-600 text-xs font-medium">✅ Sent</span>
                      ) : (
                        <button onClick={() => sendLink(emp)} disabled={sending}
                          className="bg-blue-900 text-white px-3 py-1 rounded text-xs hover:bg-blue-800 disabled:opacity-50">
                          📧 Send Link
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Onboarding
