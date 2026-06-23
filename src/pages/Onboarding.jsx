import { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function Onboarding() {
  const [view, setView] = useState('main')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [pendingEmployees, setPendingEmployees] = useState([])
  const [showBulkSend, setShowBulkSend] = useState(false)

  const requiredCols = ['first_name', 'mobile', 'personal_email', 'date_of_joining', 'designation', 'state_code']
  const stateList = ['DL','HR','KA','UP','MP','TG','TN','AP','MH','GJ','OR','WB','JH']

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
  '', '', '15000', '5200', '3350',
  '1250'
]
    const ws = XLSX.utils.aoa_to_sheet([headers, sample])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees')
    XLSX.writeFile(wb, 'PeopleOne_Employee_Import_Template.xlsx')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { raw: false })
      const errs = []
      const cleaned = data.map((row, i) => {
        const rowErrors = []
        requiredCols.forEach(col => { if (!row[col]) rowErrors.push(`${col} missing`) })
        if (row.state_code && !stateList.includes(row.state_code.toUpperCase())) rowErrors.push(`Invalid state_code`)
        if (row.mobile && !/^\d{10}$/.test(row.mobile.toString().replace(/\s/g, ''))) rowErrors.push(`Invalid mobile`)
        if (rowErrors.length > 0) errs.push({ row: i + 2, name: row.first_name || '?', errors: rowErrors })
        return { ...row, state_code: row.state_code?.toUpperCase(), _hasError: rowErrors.length > 0 }
      })
      setRows(cleaned)
      setErrors(errs)
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setImporting(true)
    setImported(0)
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    const { data: sites } = await supabase.from('client_sites').select('id, site_name, state_code')
    const validRows = rows.filter(r => !r._hasError)
    const { count: existingCount } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    let count = 0
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const site = sites?.find(s =>
        s.site_name.toLowerCase().includes(row.client_site_name?.toLowerCase()) ||
        row.client_site_name?.toLowerCase().includes(s.site_name.toLowerCase())
      )
      const empCode = row.employee_code || `EMP-${String((existingCount || 0) + i + 1).padStart(4, '0')}`
      const { error } = await supabase.from('employees').insert({
          employee_code: empCode,
  first_name: row.first_name,
  last_name: row.last_name || null,
  mobile: row.mobile?.toString(),
  personal_email: row.personal_email,
  date_of_joining: row.date_of_joining,
  designation: row.designation || null,
  department: row.department || null,
  current_site_id: site?.id || null,
  pan: row.pan || null,
  uan_number: row.uan_number || null,
  bank_account_no: row.bank_account_no || null,
  bank_ifsc: row.bank_ifsc || null,
  bank_name: row.bank_name || null,
  gender: row.gender || null,
  father_name: row.father_name || null,
  date_of_birth: row.date_of_birth || null,
  blood_group: row.blood_group || null,
  work_experience: row.work_experience || null,
  source: row.source || null,
  old_uan: row.old_uan || null,
  old_esic_no: row.old_esic_no || null,
  company_id: company?.id || null,
  status: 'onboarding',
})
if (!error && (row.basic || row.gross_monthly)) {
  const gross = Number(row.gross_monthly) || 
    (Number(row.basic) + Number(row.hra || 0) + 
     Number(row.special_allowance || 0) + 
     Number(row.statutory_bonus || 0))
  
  const basic = Number(row.basic) || Math.round(gross * 0.5)
  const hra = Number(row.hra) || Math.round(basic * 0.4)
  const specialAllowance = Number(row.special_allowance) || 0
  const statutoryBonus = Number(row.statutory_bonus) || 0
  
  const pfEmp = Math.min(Math.round(basic * 0.12), 1800)
  const esicEmp = gross <= 21000 ? Math.round(gross * 0.0075) : 0
  const pfEr = Math.min(Math.round(basic * 0.12), 1800)
  const esicEr = gross <= 21000 ? Math.round(gross * 0.0325) : 0
  const inHand = gross - pfEmp - esicEmp

  // Get inserted employee id
  const { data: newEmp } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_code', empCode)
    .single()

  if (newEmp) {
    await supabase.from('employee_salary').insert({
      employee_id: newEmp.id,
      effective_from: row.date_of_joining,
      gross_monthly: gross,
      ctc_annual: (gross + pfEr + esicEr) * 12,
      basic,
      hra,
      special_allowance: specialAllowance,
      statutory_bonus: statutoryBonus,
      in_hand: inHand,
    })
  }
}
      if (!error) { count++; setImported(count) }
    }
    setImporting(false)
    setDone(true)
  }

  async function fetchPendingEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'onboarding')
      .is('onboarding_completed_at', null)
    if (data) setPendingEmployees(data)
    setShowBulkSend(true)
  }

  async function handleBulkSend() {
    setSending(true)
    setSentCount(0)
    let count = 0
    for (const emp of pendingEmployees) {
      if (!emp.personal_email) continue
      const token = crypto.randomUUID()
      await supabase.from('employees').update({
        onboarding_token: token,
        onboarding_link_sent_at: new Date().toISOString()
      }).eq('id', emp.id)
      await supabase.functions.invoke('send-onboarding-email', {
        body: {
          employee_name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          employee_email: emp.personal_email,
          onboarding_token: token,
        }
      })
      count++
      setSentCount(count)
    }
    setSending(false)
    setDone(true)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Onboarding</h2>

      {view === 'main' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Bulk Import Card */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="text-4xl mb-3">📥</div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Bulk Import</h3>
            <p className="text-gray-500 text-sm mb-4">Import 1000+ employees from Excel in one go.</p>
            <button onClick={() => setView('import')}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition">
              Start Bulk Import
            </button>
          </div>

          {/* Send Links Card */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="text-4xl mb-3">📧</div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Send Onboarding Links</h3>
            <p className="text-gray-500 text-sm mb-4">Send onboarding links to all pending employees in bulk.</p>
            <button onClick={fetchPendingEmployees}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Send Bulk Links
            </button>
          </div>

        </div>
      )}

      {/* Bulk Send Modal */}
      {showBulkSend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
            {!done ? (
              <>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Send Onboarding Links</h3>
                <p className="text-gray-500 text-sm mb-4">{pendingEmployees.length} employees pending onboarding.</p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
                  {pendingEmployees.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center">No pending employees!</p>
                  ) : (
                    pendingEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{emp.first_name} {emp.last_name || ''}</p>
                          <p className="text-xs text-gray-400">{emp.personal_email || '⚠️ No email'}</p>
                        </div>
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">Pending</span>
                      </div>
                    ))
                  )}
                </div>
                {sending && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Sending...</span>
                      <span className="font-medium text-blue-900">{sentCount} / {pendingEmployees.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-900 h-2 rounded-full transition-all"
                        style={{ width: `${(sentCount / pendingEmployees.length) * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setShowBulkSend(false)} disabled={sending}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleBulkSend}
                    disabled={sending || pendingEmployees.length === 0}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {sending ? 'Sending...' : `📧 Send ${pendingEmployees.filter(e => e.personal_email).length} Links`}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-5xl mb-3">🎉</p>
                <h3 className="text-xl font-bold text-green-600 mb-2">All Links Sent!</h3>
                <p className="text-gray-500">{sentCount} onboarding links sent successfully.</p>
                <button onClick={() => { setShowBulkSend(false); setDone(false); setSentCount(0) }}
                  className="mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'import' && (
        <div className="max-w-3xl">
          <button onClick={() => { setView('main'); setRows([]); setErrors([]); setDone(false) }}
            className="text-blue-900 text-sm font-medium mb-4 hover:underline">
            ← Back
          </button>

          {!done ? (
            <>
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h3 className="font-semibold text-gray-700 mb-1">Step 1 — Download Template</h3>
                <p className="text-gray-400 text-sm mb-3">Fill employee data in this format and upload below.</p>
                <button onClick={downloadTemplate}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  ⬇️ Download Excel Template
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h3 className="font-semibold text-gray-700 mb-1">Step 2 — Upload Filled Excel</h3>
                <p className="text-gray-400 text-sm mb-3">System will validate automatically.</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-900 file:text-white file:cursor-pointer" />
              </div>

              {rows.length > 0 && (
                <div className="bg-white rounded-2xl shadow p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">Preview — {rows.length} rows</h3>
                    <div className="flex gap-3 text-sm">
                      <span className="text-green-600 font-medium">✅ {rows.filter(r => !r._hasError).length} valid</span>
                      {errors.length > 0 && <span className="text-red-500 font-medium">❌ {errors.length} errors</span>}
                    </div>
                  </div>
                  {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-red-600 font-medium text-sm mb-2">Rows with errors (will be skipped):</p>
                      {errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-red-500 text-xs">Row {e.row} ({e.name}): {e.errors.join(', ')}</p>
                      ))}
                      {errors.length > 5 && <p className="text-red-400 text-xs">...and {errors.length - 5} more</p>}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Mobile</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Joining</th>
                          <th className="px-3 py-2 text-left">State</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={`border-t ${row._hasError ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2">{row.first_name} {row.last_name || ''}</td>
                            <td className="px-3 py-2">{row.mobile}</td>
                            <td className="px-3 py-2">{row.personal_email}</td>
                            <td className="px-3 py-2">{row.date_of_joining}</td>
                            <td className="px-3 py-2">
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{row.state_code}</span>
                            </td>
                            <td className="px-3 py-2">
                              {row._hasError
                                ? <span className="text-red-500">❌ Error</span>
                                : <span className="text-green-600">✅ Valid</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 10 && <p className="text-gray-400 text-xs mt-2 text-center">...and {rows.length - 10} more rows</p>}
                  </div>
                  {rows.filter(r => !r._hasError).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      {importing ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Importing...</span>
                            <span className="text-sm font-medium text-blue-900">{imported} / {rows.filter(r => !r._hasError).length}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-900 h-2 rounded-full transition-all"
                              style={{ width: `${(imported / rows.filter(r => !r._hasError).length) * 100}%` }} />
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleImport}
                          className="bg-blue-900 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800">
                          📥 Import {rows.filter(r => !r._hasError).length} Employees
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow p-10 text-center">
              <p className="text-6xl mb-4">🎉</p>
              <h3 className="text-2xl font-bold text-green-600 mb-2">Import Complete!</h3>
              <p className="text-gray-500">{imported} employees imported successfully.</p>
              <button onClick={() => { setView('main'); setRows([]); setErrors([]); setDone(false) }}
                className="mt-6 bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium">
                Back to Onboarding
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Onboarding