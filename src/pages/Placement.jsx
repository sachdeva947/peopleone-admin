import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function Placement() {
  const [activeTab, setActiveTab] = useState('clients')

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'clients',    label: '🏢 Client Master' },
          { key: 'placements', label: '👤 Placements' },
          { key: 'invoices',   label: '🧾 Invoices' },
          { key: 'guarantee',  label: '🛡️ Guarantee Tracker' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'clients'    && <ClientMaster />}
      {activeTab === 'placements' && <Placements />}
      {activeTab === 'invoices'   && <PlacementInvoices />}
      {activeTab === 'guarantee'  && <GuaranteeTracker />}
    </div>
  )
}

function ClientMaster() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    client_name: '', legal_name: '', gstin: '', pan: '',
    billing_address: '', state_code: '',
    contact_person: '', contact_email: '', contact_phone: '',
    payment_terms_days: 30, default_billing_type: 'per_employee',
    default_markup_pct: 0,
  })

  const states = [
    { code: 'DL', name: 'Delhi' }, { code: 'HR', name: 'Haryana' },
    { code: 'KA', name: 'Karnataka' }, { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'MP', name: 'Madhya Pradesh' }, { code: 'TG', name: 'Telangana' },
    { code: 'TN', name: 'Tamil Nadu' }, { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'MH', name: 'Maharashtra' }, { code: 'GJ', name: 'Gujarat' },
    { code: 'OR', name: 'Odisha' }, { code: 'WB', name: 'West Bengal' },
    { code: 'JH', name: 'Jharkhand' },
  ]

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('client_name')
    if (data) setClients(data)
    setLoading(false)
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    if (!form.client_name) return
    setSaving(true)
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    if (editId) {
      await supabase.from('clients').update({ ...form, company_id: company?.id }).eq('id', editId)
    } else {
      await supabase.from('clients').insert({ ...form, company_id: company?.id, is_active: true })
    }
    setSaving(false)
    setShowForm(false)
    setEditId(null)
    setForm({ client_name: '', legal_name: '', gstin: '', pan: '', billing_address: '', state_code: '', contact_person: '', contact_email: '', contact_phone: '', payment_terms_days: 30, default_billing_type: 'per_employee', default_markup_pct: 0 })
    fetchClients()
  }

  function handleEdit(client) {
    setForm(client)
    setEditId(client.id)
    setShowForm(true)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Client Master ({clients.length})</h3>
        <button onClick={() => { setShowForm(!showForm); setEditId(null) }}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800">
          + Add Client
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h4 className="font-semibold text-gray-700 mb-4">{editId ? 'Edit' : 'New'} Client</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Client Name *</label>
              <input name="client_name" value={form.client_name} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Legal Name</label>
              <input name="legal_name" value={form.legal_name} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">GSTIN</label>
              <input name="gstin" value={form.gstin} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">PAN</label>
              <input name="pan" value={form.pan} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">State</label>
              <select name="state_code" value={form.state_code} onChange={handleChange} className={inputClass}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Payment Terms (days)</label>
              <input type="number" name="payment_terms_days" value={form.payment_terms_days} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Contact Person</label>
              <input name="contact_person" value={form.contact_person} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Contact Email</label>
              <input name="contact_email" value={form.contact_email} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Contact Phone</label>
              <input name="contact_phone" value={form.contact_phone} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Default Markup %</label>
              <input type="number" name="default_markup_pct" value={form.default_markup_pct} onChange={handleChange} className={inputClass} /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-600 mb-1">Billing Address</label>
              <textarea name="billing_address" value={form.billing_address} onChange={handleChange} rows={2} className={inputClass} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving...' : editId ? 'Update Client' : 'Save Client'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading...</p> : clients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-gray-400">No clients yet. Add your first client.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">GSTIN</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">Terms</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3"><p className="font-medium">{c.client_name}</p>
                    <p className="text-xs text-gray-400">{c.legal_name || '—'}</p></td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.gstin || '—'}</td>
                  <td className="px-4 py-3"><p className="text-sm">{c.contact_person || '—'}</p>
                    <p className="text-xs text-gray-400">{c.contact_email || '—'}</p></td>
                  <td className="px-4 py-3">{c.state_code &&
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{c.state_code}</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{c.payment_terms_days} days</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(c)}
                      className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-200">✏️ Edit</button>
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

function Placements() {
  const [placements, setPlacements] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_id: '', candidate_name: '', candidate_email: '',
    candidate_phone: '', designation: '', department: '',
    annual_ctc: '', date_of_offer: '', date_of_joining: '',
    guarantee_days: 90, notes: '',
  })

  useEffect(() => {
    async function fetchData() {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('permanent_placements').select('*, clients(client_name)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, client_name').eq('is_active', true)
      ])
      if (p) setPlacements(p)
      if (c) setClients(c)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function handleSave() {
    if (!form.client_id || !form.candidate_name) return
    setSaving(true)
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    const guaranteeExpiry = form.date_of_joining
      ? new Date(new Date(form.date_of_joining).getTime() + form.guarantee_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null
    await supabase.from('permanent_placements').insert({
      ...form, company_id: company?.id,
      annual_ctc: Number(form.annual_ctc),
      guarantee_days: Number(form.guarantee_days),
      guarantee_expiry: guaranteeExpiry, status: 'active',
    })
    setSaving(false)
    setShowForm(false)
    setForm({ client_id: '', candidate_name: '', candidate_email: '', candidate_phone: '', designation: '', department: '', annual_ctc: '', date_of_offer: '', date_of_joining: '', guarantee_days: 90, notes: '' })
    const { data } = await supabase.from('permanent_placements').select('*, clients(client_name)').order('created_at', { ascending: false })
    if (data) setPlacements(data)
  }

  const statusColor = { active: 'bg-green-100 text-green-700', exited: 'bg-red-100 text-red-700', replaced: 'bg-blue-100 text-blue-700' }
  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Permanent Placements ({placements.length})</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800">
          + New Placement
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h4 className="font-semibold text-gray-700 mb-4">New Placement</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Client *</label>
              <select name="client_id" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className={inputClass}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Candidate Name *</label>
              <input name="candidate_name" value={form.candidate_name} onChange={e => setForm({ ...form, candidate_name: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <input name="candidate_email" value={form.candidate_email} onChange={e => setForm({ ...form, candidate_email: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
              <input name="candidate_phone" value={form.candidate_phone} onChange={e => setForm({ ...form, candidate_phone: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Designation</label>
              <input name="designation" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Annual CTC (Rs.)</label>
              <input type="number" name="annual_ctc" value={form.annual_ctc} onChange={e => setForm({ ...form, annual_ctc: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Guarantee Period (days)</label>
              <input type="number" value={form.guarantee_days} onChange={e => setForm({ ...form, guarantee_days: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Date of Joining</label>
              <input type="date" value={form.date_of_joining} onChange={e => setForm({ ...form, date_of_joining: e.target.value })} className={inputClass} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Placement'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading...</p> : placements.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center"><p className="text-gray-400">No placements yet.</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-right">Annual CTC</th>
                <th className="px-4 py-3 text-left">Joining</th>
                <th className="px-4 py-3 text-left">Guarantee Till</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((p, i) => {
                const guaranteeExpiry = p.guarantee_expiry ? new Date(p.guarantee_expiry) : null
                const isExpiringSoon = guaranteeExpiry && guaranteeExpiry > new Date() &&
                  (guaranteeExpiry - new Date()) / (1000 * 60 * 60 * 24) <= 15
                return (
                  <tr key={p.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3"><p className="font-medium">{p.candidate_name}</p></td>
                    <td className="px-4 py-3 text-gray-600">{p.clients?.client_name}</td>
                    <td className="px-4 py-3 text-right font-medium">Rs.{p.annual_ctc ? Number(p.annual_ctc).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.date_of_joining ? new Date(p.date_of_joining).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={isExpiringSoon ? 'text-orange-500 font-medium' : 'text-gray-500'}>
                        {guaranteeExpiry ? guaranteeExpiry.toLocaleDateString('en-IN') : '—'}
                        {isExpiringSoon && ' ⚠️'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
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

function PlacementInvoices() {
  const [invoices, setInvoices] = useState([])
  const [placements, setPlacements] = useState([])
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    placement_id: '', fee_pct: 8.33, discount_pct: 0,
    payment_type: 'single', due_days: 30, notes: '',
  })

  useEffect(() => {
    async function fetchData() {
      const [{ data: inv }, { data: pl }, { data: co }] = await Promise.all([
        supabase.from('placement_invoices').select('*, clients(client_name), permanent_placements(candidate_name)').order('created_at', { ascending: false }),
        supabase.from('permanent_placements').select('id, candidate_name, annual_ctc, client_id, clients(client_name)').eq('status', 'active'),
        supabase.from('companies').select('*').limit(1).single()
      ])
      if (inv) setInvoices(inv)
      if (pl) setPlacements(pl)
      if (co) setCompany(co)
      setLoading(false)
    }
    fetchData()
  }, [])

  const selectedPlacement = placements.find(p => p.id === form.placement_id)
  const annualCTC = selectedPlacement ? Number(selectedPlacement.annual_ctc) : 0
  const feeAmount = Math.round(annualCTC * Number(form.fee_pct) / 100)
  const discountAmount = form.discount_pct > 0 ? Math.round(feeAmount * Number(form.discount_pct) / 100) : 0
  const netFee = feeAmount - discountAmount
  const gstAmount = Math.round(netFee * 0.18)
  const total = netFee + gstAmount

  async function handleSave() {
    if (!form.placement_id) return
    setSaving(true)
    const now = new Date()
    const fy = now.getMonth() >= 3
      ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`
    const { count } = await supabase.from('placement_invoices').select('*', { count: 'exact', head: true })
    const invNumber = `PL/${fy}/${String((count || 0) + 1).padStart(3, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + Number(form.due_days))
    const clientId = selectedPlacement?.client_id
    await supabase.from('placement_invoices').insert({
      company_id: company?.id, placement_id: form.placement_id,
      client_id: clientId, invoice_number: invNumber,
      invoice_date: now.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      payment_type: form.payment_type, annual_ctc: annualCTC,
      fee_pct: Number(form.fee_pct), fee_amount: feeAmount,
      discount_pct: Number(form.discount_pct), discount_amount: discountAmount,
      net_fee: netFee, gst_pct: 18, gst_amount: gstAmount,
      total_amount: total, status: 'draft', paid_amount: 0, balance_amount: total,
      notes: form.notes,
    })
    setSaving(false)
    setShowForm(false)
    const { data } = await supabase.from('placement_invoices').select('*, clients(client_name), permanent_placements(candidate_name)').order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  function generatePDF(inv) {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.width
    doc.setFillColor(26, 58, 92)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(company?.name || 'PeopleOne', pageW / 2, 12, { align: 'center' })
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('Permanent Placement Services', pageW / 2, 20, { align: 'center' })
    doc.setFillColor(200, 150, 12)
    doc.rect(0, 28, pageW, 8, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text('PLACEMENT FEE INVOICE', pageW / 2, 34, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    autoTable(doc, {
      startY: 42,
      body: [[
        { content: `Invoice No: ${inv.invoice_number}\nDate: ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}`, styles: { fontStyle: 'bold' } },
        { content: `Bill To:\n${inv.clients?.client_name || '—'}` }
      ]],
      theme: 'grid', styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 90, fillColor: [240, 245, 255] }, 1: { cellWidth: 90 } },
      margin: { left: 10, right: 10 },
    })
    const feeRows = [
      ['Candidate', inv.permanent_placements?.candidate_name || '—'],
      ['Annual CTC', `Rs.${Number(inv.annual_ctc).toLocaleString()}`],
      ['Placement Fee', `@ ${inv.fee_pct}%  =  Rs.${Number(inv.fee_amount).toLocaleString()}`],
    ]
    if (Number(inv.discount_amount) > 0) {
      feeRows.push([`Discount @ ${inv.discount_pct}%`, `-Rs.${Number(inv.discount_amount).toLocaleString()}`])
      feeRows.push(['Net Fee', `Rs.${Number(inv.net_fee).toLocaleString()}`])
    }
    feeRows.push([`GST @ 18%`, `Rs.${Number(inv.gst_amount).toLocaleString()}`])
    feeRows.push([{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: `Rs.${Number(inv.total_amount).toLocaleString()}`, styles: { fontStyle: 'bold' } }])
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      body: feeRows, theme: 'grid', styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 90, fillColor: [240, 245, 255] }, 1: { cellWidth: 90, halign: 'right' } },
      margin: { left: 10, right: 10 },
    })
    doc.save(`${inv.invoice_number.replace(/\//g, '_')}.pdf`)
  }

  const statusColor = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700', partial: 'bg-yellow-100 text-yellow-700' }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Placement Invoices</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800">
          + Create Invoice
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h4 className="font-semibold text-gray-700 mb-4">New Placement Invoice</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Placement *</label>
              <select value={form.placement_id} onChange={e => setForm({ ...form, placement_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Placement</option>
                {placements.map(p => <option key={p.id} value={p.id}>{p.candidate_name} — {p.clients?.client_name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Fee %</label>
              <select value={form.fee_pct} onChange={e => setForm({ ...form, fee_pct: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="8.33">8.33% (1 month)</option>
                <option value="16.66">16.66% (2 months)</option>
              </select></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Discount % (optional)</label>
              <input type="number" value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" step="0.01" /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Payment Type</label>
              <select value={form.payment_type} onChange={e => setForm({ ...form, payment_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="single">Single Invoice</option>
                <option value="split_50_50">50-50 Split</option>
              </select></div>
          </div>
          {annualCTC > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Preview</p>
              <div className="space-y-1 text-sm max-w-xs">
                <div className="flex justify-between"><span className="text-gray-500">Fee @ {form.fee_pct}%</span><span>Rs.{feeAmount.toLocaleString()}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Discount @ {form.discount_pct}%</span><span>-Rs.{discountAmount.toLocaleString()}</span></div>}
                {discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">Net Fee</span><span>Rs.{netFee.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">GST @ 18%</span><span>Rs.{gstAmount.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-blue-900"><span>Total</span><span>Rs.{total.toLocaleString()}</span></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Creating...' : '✅ Create Invoice'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center"><p className="text-gray-400">No placement invoices yet.</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 font-medium">{inv.permanent_placements?.candidate_name}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.clients?.client_name}</td>
                  <td className="px-4 py-3 text-right font-medium">Rs.{Number(inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[inv.status] || 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => generatePDF(inv)}
                      className="bg-blue-900 text-white px-3 py-1 rounded text-xs hover:bg-blue-800">📄 PDF</button>
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

function GuaranteeTracker() {
  const [placements, setPlacements] = useState([])
  const [loading, setLoading] = useState(true)
  const [markingExit, setMarkingExit] = useState(null)
  const [exitForm, setExitForm] = useState({ exit_date: '', exit_reason: '' })

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('permanent_placements')
        .select('*, clients(client_name)')
        .eq('status', 'active')
        .order('guarantee_expiry', { ascending: true })
      if (data) setPlacements(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function markExit(placement) {
    if (!exitForm.exit_date) return
    const exitDate = new Date(exitForm.exit_date)
    const guaranteeExpiry = new Date(placement.guarantee_expiry)
    const inGuaranteePeriod = exitDate <= guaranteeExpiry
    await supabase.from('permanent_placements').update({
      status: 'exited', exit_date: exitForm.exit_date,
      exit_reason: exitForm.exit_reason, replacement_required: inGuaranteePeriod,
    }).eq('id', placement.id)
    setMarkingExit(null)
    setExitForm({ exit_date: '', exit_reason: '' })
    const { data } = await supabase.from('permanent_placements').select('*, clients(client_name)').eq('status', 'active').order('guarantee_expiry', { ascending: true })
    if (data) setPlacements(data)
  }

  const today = new Date()
  const categories = {
    expiringSoon: placements.filter(p => {
      const exp = p.guarantee_expiry ? new Date(p.guarantee_expiry) : null
      return exp && exp >= today && (exp - today) / (1000 * 60 * 60 * 24) <= 15
    }),
    safe: placements.filter(p => {
      const exp = p.guarantee_expiry ? new Date(p.guarantee_expiry) : null
      return exp && exp >= today && (exp - today) / (1000 * 60 * 60 * 24) > 15
    }),
    expired: placements.filter(p => p.guarantee_expiry && new Date(p.guarantee_expiry) < today),
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{categories.safe.length}</p>
          <p className="text-sm text-green-700">✅ Safe</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{categories.expiringSoon.length}</p>
          <p className="text-sm text-orange-600">⚠️ Expiring Soon</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-500">{categories.expired.length}</p>
          <p className="text-sm text-gray-600">🔒 Expired</p>
        </div>
      </div>

      {placements.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center"><p className="text-gray-400">No active placements.</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Guarantee Till</th>
                <th className="px-4 py-3 text-left">Days Left</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((p, i) => {
                const exp = p.guarantee_expiry ? new Date(p.guarantee_expiry) : null
                const daysLeft = exp ? Math.ceil((exp - today) / (1000 * 60 * 60 * 24)) : null
                const color = daysLeft === null ? '' : daysLeft < 0 ? 'text-gray-400' : daysLeft <= 15 ? 'text-orange-500 font-semibold' : 'text-green-600'
                return (
                  <tr key={p.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3"><p className="font-medium">{p.candidate_name}</p></td>
                    <td className="px-4 py-3 text-gray-600">{p.clients?.client_name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.date_of_joining ? new Date(p.date_of_joining).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{exp ? exp.toLocaleDateString('en-IN') : '—'}</td>
                    <td className={`px-4 py-3 ${color}`}>{daysLeft === null ? '—' : daysLeft < 0 ? 'Expired' : `${daysLeft} days`}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setMarkingExit(p)}
                        className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200">Mark Exit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {markingExit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-semibold text-gray-700 mb-1">Mark Exit</h3>
            <p className="text-sm text-gray-400 mb-4">{markingExit.candidate_name}</p>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Exit Date *</label>
                <input type="date" value={exitForm.exit_date} onChange={e => setExitForm({ ...exitForm, exit_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Exit Reason</label>
                <textarea value={exitForm.exit_reason} onChange={e => setExitForm({ ...exitForm, exit_reason: e.target.value })}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              {exitForm.exit_date && markingExit.guarantee_expiry && new Date(exitForm.exit_date) <= new Date(markingExit.guarantee_expiry) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm font-medium">⚠️ Exit within guarantee period! Replacement required.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setMarkingExit(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => markExit(markingExit)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Confirm Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Placement