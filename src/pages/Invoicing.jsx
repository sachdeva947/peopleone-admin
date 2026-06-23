import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function Invoicing() {
  const [activeTab, setActiveTab] = useState('list')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'list',   label: '📋 Invoices' },
          { key: 'create', label: '➕ Create Invoice' },
          { key: 'track',  label: '💰 Payment Tracking' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'list'   && <InvoiceList onSelect={() => setActiveTab('list')} />}
      {activeTab === 'create' && <CreateInvoice onSuccess={() => setActiveTab('list')} />}
      {activeTab === 'track'  && <PaymentTracking />}
    </div>
  )
}

// ── INVOICE LIST ──────────────────────────────────────────────
function InvoiceList({ onSelect }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [{ data: inv }, { data: co }] = await Promise.all([
        supabase.from('invoices').select('*, client_sites(site_name, state_code)').order('created_at', { ascending: false }),
        supabase.from('companies').select('*').limit(1).single()
      ])
      if (inv) setInvoices(inv)
      if (co) setCompany(co)
      setLoading(false)
    }
    fetchData()
  }, [])

  const statusColor = {
    draft:     'bg-gray-100 text-gray-600',
    sent:      'bg-blue-100 text-blue-700',
    partial:   'bg-yellow-100 text-yellow-700',
    paid:      'bg-green-100 text-green-700',
    overdue:   'bg-red-100 text-red-700',
    cancelled: 'bg-red-50 text-red-400',
  }

  async function generatePDF(inv) {
    const { data: lines } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', inv.id)

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.width

    // Header
    doc.setFillColor(26, 58, 92)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(company?.name || 'PeopleOne', pageW / 2, 12, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(company?.registered_address || '', pageW / 2, 19, { align: 'center' })
    doc.text(`GSTIN: ${company?.gstin || '—'}   PAN: ${company?.pan || '—'}`, pageW / 2, 25, { align: 'center' })

    // Gold bar
    doc.setFillColor(200, 150, 12)
    doc.rect(0, 28, pageW, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TAX INVOICE', pageW / 2, 34, { align: 'center' })

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    // Invoice + Client details
    autoTable(doc, {
      startY: 42,
      head: [],
      body: [
        [
          { content: `Invoice No: ${inv.invoice_number}\nDate: ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}\nDue Date: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '—'}\nBilling Period: ${new Date(inv.billing_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`, styles: { fontStyle: 'bold' } },
          { content: `Bill To:\n${inv.client_name || inv.client_sites?.site_name || '—'}\n${inv.client_address || '—'}\nGSTIN: ${inv.client_gstin || '—'}` }
        ]
      ],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 90, fillColor: [240, 245, 255] },
        1: { cellWidth: 90 }
      },
      margin: { left: 10, right: 10 },
    })

    // Line items
    if (lines && lines.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 6,
        head: [['#', 'Employee', 'Designation', 'Days', 'CTC', 'Markup', 'Amount']],
        body: lines.map((l, i) => [
          i + 1,
          `${l.employee_name}\n${l.employee_code}`,
          l.designation || '—',
          `${l.paid_days}/${l.working_days}`,
          `Rs.${Number(l.ctc_monthly).toLocaleString()}`,
          `${l.markup_pct}%`,
          `Rs.${Number(l.billing_amount).toLocaleString()}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [26, 58, 92], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 8 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
        margin: { left: 10, right: 10 },
      })
    } else {
      // Fixed amount invoice
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 6,
        head: [['Description', 'Amount']],
        body: [
          [`Manpower Services — ${new Date(inv.billing_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`, `Rs.${Number(inv.subtotal).toLocaleString()}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [26, 58, 92], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 10, right: 10 },
      })
    }

    // GST Summary
    const gstY = doc.lastAutoTable.finalY + 4
    autoTable(doc, {
      startY: gstY,
      head: [],
      body: [
        ['', '', 'Subtotal', `Rs.${Number(inv.subtotal).toLocaleString()}`],
        ...(inv.cgst_amount > 0 ? [['', '', `CGST @ ${inv.cgst_pct}%`, `Rs.${Number(inv.cgst_amount).toLocaleString()}`]] : []),
        ...(inv.sgst_amount > 0 ? [['', '', `SGST @ ${inv.sgst_pct}%`, `Rs.${Number(inv.sgst_amount).toLocaleString()}`]] : []),
        ...(inv.igst_amount > 0 ? [['', '', `IGST @ ${inv.igst_pct}%`, `Rs.${Number(inv.igst_amount).toLocaleString()}`]] : []),
        ['', '', { content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: `Rs.${Number(inv.total_amount).toLocaleString()}`, styles: { fontStyle: 'bold' } }],
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60, fillColor: [255, 255, 255] },
        1: { cellWidth: 60, fillColor: [255, 255, 255] },
        2: { cellWidth: 40, fillColor: [240, 245, 255] },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 10, right: 10 },
    })

    // Bank details + footer
    const bankY = doc.lastAutoTable.finalY + 6
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Bank Details:', 10, bankY)
    doc.setFont('helvetica', 'normal')
    doc.text(`Bank: ${company?.bank_name || '—'}   Account: ${company?.bank_account_no || '—'}   IFSC: ${company?.bank_ifsc || '—'}`, 10, bankY + 5)

    // Footer
    const footY = bankY + 15
    doc.setDrawColor(200, 150, 12)
    doc.setLineWidth(0.5)
    doc.line(10, footY, pageW - 10, footY)
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.text('This is a computer-generated invoice.', pageW / 2, footY + 5, { align: 'center' })
    doc.text(`PeopleOne — Staffing & Payroll Platform   |   ${company?.pan || ''}`, pageW / 2, footY + 10, { align: 'center' })

    doc.save(`${inv.invoice_number.replace('/', '_')}.pdf`)
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">All Invoices ({invoices.length})</h3>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-gray-400">No invoices yet. Create your first invoice.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Invoice No</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{inv.client_name || inv.client_sites?.site_name}</p>
                    <p className="text-xs text-gray-400">{inv.client_sites?.state_code}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.billing_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">Rs.{Number(inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">Rs.{Number(inv.balance_amount || inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => generatePDF(inv)}
                      className="bg-blue-900 text-white px-3 py-1 rounded text-xs hover:bg-blue-800"
                    >
                      📄 PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── CREATE INVOICE ────────────────────────────────────────────
function CreateInvoice({ onSuccess }) {
  const [sites, setSites] = useState([])
  const [payrollMonths, setPayrollMonths] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [lineItems, setLineItems] = useState([])

  const [form, setForm] = useState({
    client_site_id: '',
    billing_month: '',
    billing_type: 'per_employee',
    fixed_amount_override: '',
    client_name: '',
    client_address: '',
    client_gstin: '',
    gst_type: 'cgst_sgst', // or 'igst'
    due_days: 30,
    notes: '',
    markup_pct: 0,
  })

  useEffect(() => {
    async function fetchData() {
      const [{ data: s }, { data: pm }] = await Promise.all([
        supabase.from('client_sites').select('*').eq('is_active', true).order('site_name'),
        supabase.from('payroll_months').select('*').order('payroll_month', { ascending: false })
      ])
      if (s) setSites(s)
      if (pm) setPayrollMonths(pm)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function fetchEmployeesForSite() {
    if (!form.client_site_id || !form.billing_month) return

    const pm = payrollMonths.find(p =>
      p.payroll_month.startsWith(form.billing_month)
    )

    if (!pm) { alert('No payroll run found for this month!'); return }

    const { data } = await supabase
      .from('employee_payroll')
      .select(`
        *,
        employees!inner(
          id, employee_code, first_name, last_name,
          designation, current_site_id
        )
      `)
      .eq('payroll_month_id', pm.id)
      .eq('employees.current_site_id', form.client_site_id)

    if (data) {
      const items = data.map(ep => ({
        employee_id: ep.employees.id,
        employee_code: ep.employees.employee_code,
        employee_name: `${ep.employees.first_name} ${ep.employees.last_name || ''}`,
        designation: ep.employees.designation || '—',
        ctc_monthly: ep.gross_earnings,
        markup_pct: Number(form.markup_pct),
        markup_amount: Math.round(ep.gross_earnings * Number(form.markup_pct) / 100),
        billing_amount: Math.round(ep.gross_earnings * (1 + Number(form.markup_pct) / 100)),
        working_days: ep.working_days || 26,
        paid_days: ep.paid_days || 26,
        selected: true,
      }))
      setLineItems(items)
    }
    setStep(2)
  }

  function toggleEmployee(idx) {
    const updated = [...lineItems]
    updated[idx].selected = !updated[idx].selected
    setLineItems(updated)
  }

  function updateMarkup(idx, pct) {
    const updated = [...lineItems]
    updated[idx].markup_pct = Number(pct)
    updated[idx].markup_amount = Math.round(updated[idx].ctc_monthly * Number(pct) / 100)
    updated[idx].billing_amount = updated[idx].ctc_monthly + updated[idx].markup_amount
    setLineItems(updated)
  }

  const selectedItems = lineItems.filter(l => l.selected)
  const subtotal = form.billing_type === 'fixed'
    ? Number(form.fixed_amount_override)
    : selectedItems.reduce((s, l) => s + l.billing_amount, 0)
  const cgst = form.gst_type === 'cgst_sgst' ? Math.round(subtotal * 0.09) : 0
  const sgst = form.gst_type === 'cgst_sgst' ? Math.round(subtotal * 0.09) : 0
  const igst = form.gst_type === 'igst' ? Math.round(subtotal * 0.18) : 0
  const total = subtotal + cgst + sgst + igst

  async function handleSave() {
    setSaving(true)
    try {
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single()

      const now = new Date()
      const fy = now.getMonth() >= 3
        ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
        : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`

      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })

      const invNumber = `INV/${fy}/${String((count || 0) + 1).padStart(3, '0')}`

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + Number(form.due_days))

      const { data: inv, error } = await supabase.from('invoices').insert({
        company_id: companyData?.id || null,
        invoice_number: invNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        client_site_id: form.client_site_id || null,
        client_name: form.client_name || null,
        client_address: form.client_address || null,
        client_gstin: form.client_gstin || null,
        billing_month: form.billing_month ? form.billing_month + '-01' : new Date().toISOString().split('T')[0],
        billing_type: form.billing_type,
        fixed_amount_override: form.fixed_amount_override ? Number(form.fixed_amount_override) : null,
        subtotal: subtotal,
        cgst_pct: form.gst_type === 'cgst_sgst' ? 9 : 0,
        sgst_pct: form.gst_type === 'cgst_sgst' ? 9 : 0,
        igst_pct: form.gst_type === 'igst' ? 18 : 0,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: total,
        status: 'draft',
        paid_amount: 0,
        balance_amount: total,
        notes: form.notes || null,
      }).select().single()

      if (!error && inv) {
        if (form.billing_type === 'per_employee' && selectedItems.length > 0) {
          for (const item of selectedItems) {
            await supabase.from('invoice_line_items').insert({
              invoice_id: inv.id,
              employee_id: item.employee_id,
              employee_code: item.employee_code,
              employee_name: item.employee_name,
              designation: item.designation,
              ctc_monthly: item.ctc_monthly,
              markup_pct: item.markup_pct,
              markup_amount: item.markup_amount,
              billing_amount: item.billing_amount,
              working_days: item.working_days,
              paid_days: item.paid_days,
            })
          }
        }
        setSaving(false)
        onSuccess()
      } else {
        alert('Error: ' + (error?.message || 'Unknown error'))
        setSaving(false)
      }
    } catch (err) {
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-3xl">

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Create Invoice — Step 1</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Client Site *</label>
              <select name="client_site_id" value={form.client_site_id}
                onChange={e => setForm({ ...form, client_site_id: e.target.value })}
                className={inputClass}>
                <option value="">Select Site</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.site_name} ({s.state_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Billing Month *</label>
              <input type="month" value={form.billing_month}
                onChange={e => setForm({ ...form, billing_month: e.target.value })}
                className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Billing Type</label>
              <select value={form.billing_type}
                onChange={e => setForm({ ...form, billing_type: e.target.value })}
                className={inputClass}>
                <option value="per_employee">Per Employee (CTC + Markup)</option>
                <option value="fixed">Fixed Amount</option>
                <option value="fixed_period">Fixed Per Period</option>
              </select>
            </div>

            {form.billing_type !== 'per_employee' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Fixed Amount (Rs.)</label>
                <input type="number" value={form.fixed_amount_override}
                  onChange={e => setForm({ ...form, fixed_amount_override: e.target.value })}
                  className={inputClass} placeholder="500000" />
              </div>
            )}

            {form.billing_type === 'per_employee' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Default Markup %</label>
                <input type="number" value={form.markup_pct}
                  onChange={e => setForm({ ...form, markup_pct: e.target.value })}
                  className={inputClass} placeholder="15" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">GST Type</label>
              <select value={form.gst_type}
                onChange={e => setForm({ ...form, gst_type: e.target.value })}
                className={inputClass}>
                <option value="cgst_sgst">CGST + SGST (Intra-state 18%)</option>
                <option value="igst">IGST (Inter-state 18%)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Due in (days)</label>
              <input type="number" value={form.due_days}
                onChange={e => setForm({ ...form, due_days: e.target.value })}
                className={inputClass} />
            </div>
          </div>

          <h4 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3 mt-4">Client Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Client Name</label>
              <input value={form.client_name}
                onChange={e => setForm({ ...form, client_name: e.target.value })}
                className={inputClass} placeholder="ABC Corp Pvt Ltd" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Client GSTIN</label>
              <input value={form.client_gstin}
                onChange={e => setForm({ ...form, client_gstin: e.target.value })}
                className={inputClass} placeholder="27AABCP1234C1Z5" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Client Address</label>
              <textarea value={form.client_address}
                onChange={e => setForm({ ...form, client_address: e.target.value })}
                rows={2} className={inputClass} placeholder="Full billing address..." />
            </div>
          </div>

          <button
            onClick={form.billing_type === 'per_employee' ? fetchEmployeesForSite : () => setStep(2)}
            className="bg-blue-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="text-blue-900 text-sm mb-4 hover:underline">← Back</button>

          {form.billing_type === 'per_employee' && lineItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-6 mb-4">
              <h3 className="font-semibold text-gray-700 mb-4">
                Employees — {selectedItems.length} selected
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 border-b">
                      <th className="px-3 py-2 text-left">✓</th>
                      <th className="px-3 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-right">CTC</th>
                      <th className="px-3 py-2 text-right">Markup %</th>
                      <th className="px-3 py-2 text-right">Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => (
                      <tr key={i} className={`border-b ${!item.selected ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={item.selected}
                            onChange={() => toggleEmployee(i)}
                            className="w-4 h-4 accent-blue-900" />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.employee_name}</p>
                          <p className="text-xs text-gray-400">{item.employee_code} | {item.designation}</p>
                        </td>
                        <td className="px-3 py-2 text-right">Rs.{item.ctc_monthly.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" value={item.markup_pct}
                            onChange={e => updateMarkup(i, e.target.value)}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-blue-900">
                          Rs.{item.billing_amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GST Summary */}
          <div className="bg-white rounded-2xl shadow p-6 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Invoice Summary</h3>
            <div className="space-y-2 text-sm max-w-xs ml-auto">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>Rs.{subtotal.toLocaleString()}</span></div>
              {cgst > 0 && <div className="flex justify-between"><span className="text-gray-500">CGST @ 9%</span><span>Rs.{cgst.toLocaleString()}</span></div>}
              {sgst > 0 && <div className="flex justify-between"><span className="text-gray-500">SGST @ 9%</span><span>Rs.{sgst.toLocaleString()}</span></div>}
              {igst > 0 && <div className="flex justify-between"><span className="text-gray-500">IGST @ 18%</span><span>Rs.{igst.toLocaleString()}</span></div>}
              <div className="flex justify-between border-t pt-2 font-bold text-blue-900 text-base">
                <span>Total</span><span>Rs.{total.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Payment terms, bank details, etc." />
            </div>

            <button onClick={handleSave} disabled={saving}
              className="mt-4 bg-green-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Creating...' : '✅ Create Invoice'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PAYMENT TRACKING ──────────────────────────────────────────
function PaymentTracking() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', payment_date: '', payment_mode: 'neft', reference_no: '', remarks: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchInvoices() }, [])

  async function fetchInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('*, client_sites(site_name)')
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'cancelled')
      .order('due_date', { ascending: true })
    if (data) setInvoices(data)
    setLoading(false)
  }

  async function handlePayment() {
    if (!payForm.amount || !payForm.payment_date) return
    setSaving(true)

    await supabase.from('invoice_payments').insert({
      invoice_id: selected.id,
      payment_date: payForm.payment_date,
      amount: Number(payForm.amount),
      payment_mode: payForm.payment_mode,
      reference_no: payForm.reference_no,
      remarks: payForm.remarks,
    })

    const newPaid = Number(selected.paid_amount) + Number(payForm.amount)
    const newBalance = Number(selected.total_amount) - newPaid
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    await supabase.from('invoices').update({
      paid_amount: newPaid,
      balance_amount: newBalance,
      status: newStatus,
    }).eq('id', selected.id)

    setSaving(false)
    setSelected(null)
    setPayForm({ amount: '', payment_date: '', payment_mode: 'neft', reference_no: '', remarks: '' })
    fetchInvoices()
  }

  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balance_amount || i.total_amount), 0)
  const overdue = invoices.filter(i => new Date(i.due_date) < new Date() && i.status !== 'paid')

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-4xl">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Total Outstanding</p>
          <p className="text-xl font-bold text-red-500">Rs.{totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Pending Invoices</p>
          <p className="text-xl font-bold text-blue-900">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Overdue</p>
          <p className="text-xl font-bold text-orange-500">{overdue.length}</p>
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-left">Due Date</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => {
              const isOverdue = new Date(inv.due_date) < new Date()
              return (
                <tr key={inv.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.client_name || inv.client_sites?.site_name}</td>
                  <td className="px-4 py-3 text-right">Rs.{Number(inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600">Rs.{Number(inv.paid_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-500">Rs.{Number(inv.balance_amount || inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '—'}
                      {isOverdue && ' ⚠️'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setSelected(inv)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                      + Payment
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-semibold text-gray-700 mb-1">Record Payment</h3>
            <p className="text-sm text-gray-400 mb-4">{selected.invoice_number} — Balance: Rs.{Number(selected.balance_amount || selected.total_amount).toLocaleString()}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount *</label>
                <input type="number" value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={selected.balance_amount || selected.total_amount} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Payment Date *</label>
                <input type="date" value={payForm.payment_date}
                  onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Payment Mode</label>
                <select value={payForm.payment_mode}
                  onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="neft">NEFT</option>
                  <option value="rtgs">RTGS</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Reference No</label>
                <input value={payForm.reference_no}
                  onChange={e => setPayForm({ ...payForm, reference_no: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="UTR / Cheque No" />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setSelected(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handlePayment} disabled={saving}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Saving...' : '✅ Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Invoicing