import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calculateEmployeePayroll } from '../lib/payrollEngine'

function Payroll() {
  const [activeTab, setActiveTab] = useState('run')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'run',     label: '▶️ Run Payroll' },
          { key: 'history', label: '📅 Payroll History' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'run'     && <RunPayroll />}
      {activeTab === 'history' && <PayrollHistory />}
    </div>
  )
}

// ── RUN PAYROLL ───────────────────────────────────────────────
function RunPayroll() {
  const [payrollMonth, setPayrollMonth] = useState('')
  const [employees, setEmployees] = useState([])
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState([])
  const [step, setStep] = useState(1) // 1=setup, 2=preview, 3=done
  const [saving, setSaving] = useState(false)

  async function fetchEmployees() {
    if (!payrollMonth) return alert('Please select payroll month!')
    setProcessing(true)

    // Get active employees with salary and site
    const { data: emps } = await supabase
      .from('employees')
      .select(`
        *,
        employee_salary!inner(
          id, gross_monthly, basic, hra, conveyance, medical, special_allowance
        ),
        client_sites(site_name, state_code)
      `)
      .eq('status', 'active')
      .is('employee_salary.effective_to', null)

    if (!emps || emps.length === 0) {
      alert('No active employees with salary assigned found!')
      setProcessing(false)
      return
    }

    // Calculate payroll for each
    const results = emps.map(emp => {
      const salary = emp.employee_salary[0]
      const stateCode = emp.client_sites?.state_code || 'DL'
      const calc = calculateEmployeePayroll(emp, salary, stateCode, payrollMonth + '-01')

      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name || ''}`,
        designation: emp.designation,
        site: emp.client_sites?.site_name || '—',
        state_code: stateCode,
        ...calc,
      }
    })

    setProcessed(results)
    setProcessing(false)
    setStep(2)
  }

  async function savePayroll() {
    setSaving(true)

    // Create payroll month record
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    const { data: pm } = await supabase.from('payroll_months').insert({
      company_id: company?.id,
      payroll_month: payrollMonth + '-01',
      status: 'approved',
    }).select().single()

    if (!pm) { alert('Error creating payroll month!'); setSaving(false); return }

    // Save each employee payroll
    for (const emp of processed) {
      await supabase.from('employee_payroll').insert({
        payroll_month_id: pm.id,
        employee_id: emp.employee_id,
        state_code: emp.state_code,
        working_days: emp.working_days,
        paid_days: emp.paid_days,
        lop_days: emp.lop_days,
        basic: emp.basic,
        hra: emp.hra,
        conveyance: emp.conveyance,
        medical: emp.medical,
        special_allowance: emp.special_allowance,
        gross_earnings: emp.gross_earnings,
        pf_employee: emp.pf_employee,
        esic_employee: emp.esic_employee,
        pt_employee: emp.pt_employee,
        lwf_employee: emp.lwf_employee,
        tds: emp.tds,
        pf_employer: emp.pf_employer,
        pf_employer_eps: emp.pf_employer_eps,
        pf_employer_epf: emp.pf_employer_epf,
        esic_employer: emp.esic_employer,
        lwf_employer: emp.lwf_employer,
        total_deductions: emp.total_deductions,
        net_pay: emp.net_pay,
        payment_status: 'pending',
      })
    }

    setSaving(false)
    setStep(3)
  }

  const totalGross = processed.reduce((s, e) => s + e.gross_earnings, 0)
  const totalPF = processed.reduce((s, e) => s + e.pf_employee + e.pf_employer, 0)
  const totalESIC = processed.reduce((s, e) => s + e.esic_employee + e.esic_employer, 0)
  const totalPT = processed.reduce((s, e) => s + e.pt_employee, 0)
  const totalNet = processed.reduce((s, e) => s + e.net_pay, 0)

  return (
    <div className="max-w-5xl">

      {/* Step 1 — Setup */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow p-6 max-w-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Run Payroll</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Payroll Month *</label>
            <input
              type="month"
              value={payrollMonth}
              onChange={e => setPayrollMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchEmployees}
            disabled={processing}
            className="bg-blue-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {processing ? 'Processing...' : '▶️ Process Payroll'}
          </button>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Payroll Preview — {payrollMonth}
            </h3>
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Employees', value: processed.length, color: 'text-blue-900' },
              { label: 'Gross Payable', value: `₹${totalGross.toLocaleString()}`, color: 'text-gray-700' },
              { label: 'Total PF', value: `₹${totalPF.toLocaleString()}`, color: 'text-orange-600' },
              { label: 'Total ESIC', value: `₹${totalESIC.toLocaleString()}`, color: 'text-purple-600' },
              { label: 'Net Payable', value: `₹${totalNet.toLocaleString()}`, color: 'text-green-600' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Employee-wise table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b">
                    <th className="px-3 py-3 text-left">Employee</th>
                    <th className="px-3 py-3 text-left">State</th>
                    <th className="px-3 py-3 text-right">Gross</th>
                    <th className="px-3 py-3 text-right">PF (Emp)</th>
                    <th className="px-3 py-3 text-right">ESIC (Emp)</th>
                    <th className="px-3 py-3 text-right">PT</th>
                    <th className="px-3 py-3 text-right">LWF</th>
                    <th className="px-3 py-3 text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((emp, i) => (
                    <tr key={emp.employee_id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-gray-400">{emp.employee_code}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{emp.state_code}</span>
                      </td>
                      <td className="px-3 py-2 text-right">₹{emp.gross_earnings.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-500">₹{emp.pf_employee.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-500">₹{emp.esic_employee.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-orange-500">₹{emp.pt_employee.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-purple-500">₹{emp.lwf_employee.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">₹{emp.net_pay.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-semibold text-sm">
                    <td className="px-3 py-3" colSpan={2}>Total ({processed.length} employees)</td>
                    <td className="px-3 py-3 text-right">₹{totalGross.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-red-500">₹{processed.reduce((s,e) => s+e.pf_employee,0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-red-500">₹{processed.reduce((s,e) => s+e.esic_employee,0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-orange-500">₹{totalPT.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-purple-500">₹{processed.reduce((s,e) => s+e.lwf_employee,0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-green-700">₹{totalNet.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <button
            onClick={savePayroll}
            disabled={saving}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : '✅ Approve & Save Payroll'}
          </button>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-md">
          <p className="text-6xl mb-4">🎉</p>
          <h3 className="text-2xl font-bold text-green-600 mb-2">Payroll Saved!</h3>
          <p className="text-gray-500">{processed.length} employees processed for {payrollMonth}.</p>
          <p className="text-gray-400 text-sm mt-2">Net Payable: <span className="font-bold text-green-700">₹{totalNet.toLocaleString()}</span></p>
          <button
            onClick={() => { setStep(1); setProcessed([]); setPayrollMonth('') }}
            className="mt-6 bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            Run Another Month
          </button>
        </div>
      )}
    </div>
  )
}

// ── PAYROLL HISTORY ───────────────────────────────────────────
function PayrollHistory() {
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState([])

  useEffect(() => {
    async function fetchMonths() {
      const { data } = await supabase
        .from('payroll_months')
        .select('*')
        .order('payroll_month', { ascending: false })
      if (data) setMonths(data)
      setLoading(false)
    }
    fetchMonths()
  }, [])

  async function fetchDetails(pmId) {
    const { data } = await supabase
      .from('employee_payroll')
      .select('*, employees(employee_code, first_name, last_name)')
      .eq('payroll_month_id', pmId)
    if (data) setDetails(data)
    setSelected(pmId)
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  if (months.length === 0) return (
    <div className="bg-white rounded-2xl shadow p-10 text-center">
      <p className="text-gray-400">No payroll runs yet.</p>
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {months.map(pm => (
          <div key={pm.id}
            onClick={() => fetchDetails(pm.id)}
            className={`bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition
              ${selected === pm.id ? 'border-2 border-blue-900' : ''}`}>
            <p className="font-semibold text-blue-900">
              {new Date(pm.payroll_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block
              ${pm.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {pm.status}
            </span>
          </div>
        ))}
      </div>

      {details.length > 0 && (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b">
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">PF</th>
                  <th className="px-4 py-3 text-right">ESIC</th>
                  <th className="px-4 py-3 text-right">PT</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-left">State</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d, i) => (
                  <tr key={d.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{d.employees?.first_name} {d.employees?.last_name || ''}</p>
                      <p className="text-xs text-gray-400">{d.employees?.employee_code}</p>
                    </td>
                    <td className="px-4 py-2 text-right">₹{Number(d.gross_earnings).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-500">₹{Number(d.pf_employee).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-500">₹{Number(d.esic_employee).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-orange-500">₹{Number(d.pt_employee).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">₹{Number(d.net_pay).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{d.state_code}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payroll