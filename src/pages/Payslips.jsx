import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function Payslips() {
  const [months, setMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [{ data: pm }, { data: co }] = await Promise.all([
        supabase.from('payroll_months').select('*').order('payroll_month', { ascending: false }),
        supabase.from('companies').select('*').limit(1).single()
      ])
      if (pm) setMonths(pm)
      if (co) setCompany(co)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function fetchPayrollDetails(pmId, month) {
    setSelectedMonth({ id: pmId, month })
    const { data } = await supabase
      .from('employee_payroll')
      .select(`
        *,
        employees(
          employee_code, first_name, last_name, designation,
          department, pan, uan_number, bank_name, bank_account_no,
          date_of_joining, client_sites(site_name, state_code)
        )
      `)
      .eq('payroll_month_id', pmId)
    if (data) setEmployees(data)
  }

  function generatePayslip(record) {
    setGenerating(record.id)
    const emp = record.employees
    const monthDate = new Date(selectedMonth.month)
    const monthName = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.width

    // ── HEADER ──────────────────────────────────────────────
    doc.setFillColor(26, 58, 92) // Navy
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(company?.name || 'PeopleOne', pageW / 2, 12, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Staffing & Payroll Platform', pageW / 2, 19, { align: 'center' })
    doc.text(company?.registered_address || '', pageW / 2, 25, { align: 'center' })

    // ── PAYSLIP TITLE ────────────────────────────────────────
    doc.setFillColor(200, 150, 12) // Gold
    doc.rect(0, 28, pageW, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`PAYSLIP — ${monthName.toUpperCase()}`, pageW / 2, 34, { align: 'center' })

    // ── EMPLOYEE DETAILS ──────────────────────────────────────
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    const empDetails = [
      ['Employee Code', emp.employee_code,         'Department', emp.department || '—'],
      ['Employee Name', `${emp.first_name} ${emp.last_name || ''}`, 'Designation', emp.designation || '—'],
      ['Date of Joining', emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString('en-IN') : '—', 'Work Location', emp.client_sites?.site_name || '—'],
      ['PAN', emp.pan || '—',                     'UAN', emp.uan_number || '—'],
      ['Bank', emp.bank_name || '—',              'Account No', emp.bank_account_no ? '****' + emp.bank_account_no.slice(-4) : '—'],
      ['Working Days', String(record.working_days || 26), 'Paid Days', String(record.paid_days || 26)],
    ]

    autoTable(doc, {
      startY: 40,
      head: [],
      body: empDetails,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 245, 255], cellWidth: 38 },
        1: { cellWidth: 50 },
        2: { fontStyle: 'bold', fillColor: [240, 245, 255], cellWidth: 38 },
        3: { cellWidth: 50 },
      },
      margin: { left: 10, right: 10 },
    })

    // ── EARNINGS & DEDUCTIONS ──────────────────────────────────
    const earningsData = [
      ['Basic Salary',        `Rs.${Number(record.basic).toLocaleString()}`],
      ['House Rent Allowance', `Rs.${Number(record.hra).toLocaleString()}`],
      ['Conveyance Allowance', `Rs.${Number(record.conveyance || 0).toLocaleString()}`],
      ['Medical Allowance',    `Rs.${Number(record.medical || 0).toLocaleString()}`],
      ['Special Allowance',    `Rs.${Number(record.special_allowance || 0).toLocaleString()}`],
    ]
    if (record.overtime > 0) earningsData.push(['Overtime', `Rs.${Number(record.overtime).toLocaleString()}`])
    if (record.bonus > 0) earningsData.push(['Bonus', `Rs.${Number(record.bonus).toLocaleString()}`])
    earningsData.push([{ content: 'GROSS EARNINGS', styles: { fontStyle: 'bold' } }, { content: `Rs.${Number(record.gross_earnings).toLocaleString()}`, styles: { fontStyle: 'bold' } }])

    const deductionsData = [
      ['Provident Fund',       `Rs.${Number(record.pf_employee).toLocaleString()}`],
      ['ESIC',                 `Rs.${Number(record.esic_employee).toLocaleString()}`],
      ['Professional Tax',     `Rs.${Number(record.pt_employee).toLocaleString()}`],
      ['Labour Welfare Fund',  `Rs.${Number(record.lwf_employee).toLocaleString()}`],
      ['TDS',                  `Rs.${Number(record.tds || 0).toLocaleString()}`],
    ]
    if (record.advance_recovery > 0) deductionsData.push(['Advance Recovery', `Rs.${Number(record.advance_recovery).toLocaleString()}`])
    deductionsData.push([{ content: 'TOTAL DEDUCTIONS', styles: { fontStyle: 'bold' } }, { content: `Rs.${Number(record.total_deductions).toLocaleString()}`, styles: { fontStyle: 'bold' } }])

    const startY = doc.lastAutoTable.finalY + 6

    // Side by side tables
    autoTable(doc, {
      startY,
      head: [['EARNINGS', 'Amount']],
      body: earningsData,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' } },
      margin: { left: 10, right: pageW / 2 + 2 },
    })

    autoTable(doc, {
      startY,
      head: [['DEDUCTIONS', 'Amount']],
      body: deductionsData,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [180, 40, 40], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' } },
      margin: { left: pageW / 2 + 2, right: 10 },
    })

    // ── NET PAY ────────────────────────────────────────────────
    const netY = doc.lastAutoTable.finalY + 6
    doc.setFillColor(26, 58, 92)
    doc.rect(10, netY, pageW - 20, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('NET PAY', 20, netY + 8)
    doc.text(`Rs.${Number(record.net_pay).toLocaleString()}`, pageW - 20, netY + 8, { align: 'right' })

    // ── EMPLOYER CONTRIBUTIONS ─────────────────────────────────
    const erY = netY + 18
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Employer Contributions (not deducted from salary):', 10, erY)
    doc.text(`PF (Employer): Rs.${Number(record.pf_employer || 0).toLocaleString()}   ESIC (Employer): Rs.${Number(record.esic_employer || 0).toLocaleString()}   LWF (Employer): Rs.${Number(record.lwf_employer || 0).toLocaleString()}`, 10, erY + 5)

    // ── FOOTER ─────────────────────────────────────────────────
    const footY = erY + 15
    doc.setDrawColor(200, 150, 12)
    doc.setLineWidth(0.5)
    doc.line(10, footY, pageW - 10, footY)
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.text('This is a computer-generated payslip and does not require a signature.', pageW / 2, footY + 5, { align: 'center' })
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}   |   PeopleOne — Staffing & Payroll Platform`, pageW / 2, footY + 10, { align: 'center' })

    // Save
    const filename = `Payslip_${emp.employee_code}_${monthName.replace(' ', '_')}.pdf`
    doc.save(filename)
    setGenerating(null)
  }

  function generateAllPayslips() {
    employees.forEach(emp => generatePayslip(emp))
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Payslips</h2>

      {/* Month Selection */}
      {!selectedMonth && (
        <div>
          <p className="text-gray-500 text-sm mb-4">Select a payroll month to generate payslips:</p>
          {months.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-10 text-center">
              <p className="text-gray-400">No payroll runs found. Run payroll first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {months.map(pm => (
                <div key={pm.id}
                  onClick={() => fetchPayrollDetails(pm.id, pm.payroll_month)}
                  className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md hover:border-blue-900 border-2 border-transparent transition">
                  <p className="font-semibold text-blue-900">
                    {new Date(pm.payroll_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </p>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded mt-1 inline-block">
                    {pm.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee List */}
      {selectedMonth && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">
              {new Date(selectedMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} — {employees.length} employees
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <button
                onClick={generateAllPayslips}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                📥 Download All
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b">
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-center">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((record, i) => (
                  <tr key={record.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{record.employees?.first_name} {record.employees?.last_name || ''}</p>
                      <p className="text-xs text-gray-400">{record.employees?.employee_code} | {record.employees?.designation || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">Rs.{Number(record.gross_earnings).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-500">Rs.{Number(record.total_deductions).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">Rs.{Number(record.net_pay).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => generatePayslip(record)}
                        disabled={generating === record.id}
                        className="bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-800 disabled:opacity-50"
                      >
                        {generating === record.id ? '...' : '📄 PDF'}
                      </button>
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

export default Payslips