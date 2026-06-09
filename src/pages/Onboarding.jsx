import { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function Onboarding() {
  const [view, setView] = useState('main') // 'main' | 'import'
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [done, setDone] = useState(false)

  const requiredCols = ['first_name', 'mobile', 'personal_email', 'date_of_joining', 'designation', 'state_code']

  const stateList = ['DL','HR','KA','UP','MP','TG','TN','AP','MH','GJ','OR','WB','JH']

  // Download template
  function downloadTemplate() {
    const headers = [
      'employee_code', 'first_name', 'last_name', 'mobile', 'personal_email',
      'date_of_joining', 'designation', 'department', 'client_site_name',
      'state_code', 'gross_monthly', 'basic_monthly', 'pan', 'uan_number',
      'bank_account_no', 'bank_ifsc', 'gender', 'date_of_birth', 'father_name'
    ]
    const sample = [
      'EMP-001', 'Rajesh', 'Kumar', '9876543210', 'rajesh@gmail.com',
      '01-06-2026', 'Security Guard', 'Operations', 'Site Name Here',
      'DL', '18000', '9000', 'ABCDE1234F', '',
      '', '', 'male', '01-01-1990', 'Ram Kumar'
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, sample])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees')
    XLSX.writeFile(wb, 'PeopleOne_Employee_Import_Template.xlsx')
  }

  // Parse uploaded Excel
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { raw: false })

      // Validate
      const errs = []
      const cleaned = data.map((row, i) => {
        const rowErrors = []

        // Required fields
        requiredCols.forEach(col => {
          if (!row[col]) rowErrors.push(`${col} missing`)
        })

        // State code validation
        if (row.state_code && !stateList.includes(row.state_code.toUpperCase())) {
          rowErrors.push(`Invalid state_code: ${row.state_code}`)
        }

        // Mobile validation
        if (row.mobile && !/^\d{10}$/.test(row.mobile.toString().replace(/\s/g, ''))) {
          rowErrors.push(`Invalid mobile: ${row.mobile}`)
        }

        if (rowErrors.length > 0) {
          errs.push({ row: i + 2, name: row.first_name || '?', errors: rowErrors })
        }

        return {
          ...row,
          state_code: row.state_code?.toUpperCase(),
          _hasError: rowErrors.length > 0
        }
      })

      setRows(cleaned)
      setErrors(errs)
    }
    reader.readAsBinaryString(file)
  }

  // Import to Supabase
  async function handleImport() {
    setImporting(true)
    setImported(0)

    // Get company
    const { data: company } = await supabase
      .from('companies').select('id').limit(1).single()

    // Get sites
    const { data: sites } = await supabase
      .from('client_sites').select('id, site_name, state_code')

    const validRows = rows.filter(r => !r._hasError)
    let count = 0

    // Get current employee count for code generation
    const { count: existingCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]

      // Match site
      const site = sites?.find(s =>
        s.site_name.toLowerCase().includes(row.client_site_name?.toLowerCase()) ||
        row.client_site_name?.toLowerCase().includes(s.site_name.toLowerCase())
      )

      const empCode = row.employee_code ||
        `EMP-${String((existingCount || 0) + i + 1).padStart(4, '0')}`

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
        gender: row.gender || null,
        father_name: row.father_name || null,
        company_id: company?.id || null,
        status: 'onboarding',
      })

      if (!error) {
        count++
        setImported(count)
      }
    }

    setImporting(false)
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
            <p className="text-gray-500 text-sm mb-4">Import 1000+ employees from Excel in one go. Download template, fill data, upload.</p>
            <button
              onClick={() => setView('import')}
              className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
            >
              Start Bulk Import
            </button>
          </div>

          {/* Send Links Card */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="text-4xl mb-3">📧</div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Send Onboarding Links</h3>
            <p className="text-gray-500 text-sm mb-4">After import, send onboarding links to all pending employees in bulk.</p>
            <button className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Send Bulk Links
            </button>
          </div>

        </div>
      )}

      {view === 'import' && (
        <div className="max-w-3xl">

          {/* Back */}
          <button
            onClick={() => { setView('main'); setRows([]); setErrors([]); setDone(false) }}
            className="text-blue-900 text-sm font-medium mb-4 hover:underline"
          >
            ← Back
          </button>

          {!done ? (
            <>
              {/* Step 1 — Download Template */}
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h3 className="font-semibold text-gray-700 mb-1">Step 1 — Download Template</h3>
                <p className="text-gray-400 text-sm mb-3">Fill employee data in this Excel format and upload below.</p>
                <button
                  onClick={downloadTemplate}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  ⬇️ Download Excel Template
                </button>
              </div>

              {/* Step 2 — Upload */}
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h3 className="font-semibold text-gray-700 mb-1">Step 2 — Upload Filled Excel</h3>
                <p className="text-gray-400 text-sm mb-3">Upload the filled template — system will validate automatically.</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-900 file:text-white file:cursor-pointer"
                />
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="bg-white rounded-2xl shadow p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">
                      Preview — {rows.length} rows found
                    </h3>
                    <div className="flex gap-3 text-sm">
                      <span className="text-green-600 font-medium">✅ {rows.filter(r => !r._hasError).length} valid</span>
                      {errors.length > 0 && <span className="text-red-500 font-medium">❌ {errors.length} errors</span>}
                    </div>
                  </div>

                  {/* Error list */}
                  {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-red-600 font-medium text-sm mb-2">Rows with errors (will be skipped):</p>
                      {errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-red-500 text-xs">Row {e.row} ({e.name}): {e.errors.join(', ')}</p>
                      ))}
                      {errors.length > 5 && <p className="text-red-400 text-xs">...and {errors.length - 5} more</p>}
                    </div>
                  )}

                  {/* Table preview */}
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

                  {/* Import button */}
                  {rows.filter(r => !r._hasError).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      {importing ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Importing...</span>
                            <span className="text-sm font-medium text-blue-900">{imported} / {rows.filter(r => !r._hasError).length}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-900 h-2 rounded-full transition-all"
                              style={{ width: `${(imported / rows.filter(r => !r._hasError).length) * 100}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleImport}
                          className="bg-blue-900 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
                        >
                          📥 Import {rows.filter(r => !r._hasError).length} Employees
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Success */
            <div className="bg-white rounded-2xl shadow p-10 text-center">
              <p className="text-6xl mb-4">🎉</p>
              <h3 className="text-2xl font-bold text-green-600 mb-2">Import Complete!</h3>
              <p className="text-gray-500">{imported} employees imported successfully.</p>
              <p className="text-gray-400 text-sm mt-2">Go to Employees page to send onboarding links.</p>
              <button
                onClick={() => { setView('main'); setRows([]); setErrors([]); setDone(false) }}
                className="mt-6 bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
              >
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