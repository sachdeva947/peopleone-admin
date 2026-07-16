import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'bg-green-100 text-green-800'  },
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800' },
  expired:   { label: 'Expired',   color: 'bg-red-100 text-red-800'      },
  exhausted: { label: 'Exhausted', color: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600'    },
}

const EMPTY_FORM = {
  wo_number:        '',
  internal_ref:     '',
  received_date:    '',
  start_date:       '',
  end_date:         '',
  po_value:         '',
  headcount:        1,
  position:         '',
  alert_at_percent: 80,
  status:           'active',
  notes:            '',
}

// ─── Main Page ────────────────────────────────────────────────
export default function WorkOrders() {
  const [wos, setWOs]               = useState([])
  const [clients, setClients]       = useState([])
  const [contracts, setContracts]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [showModal, setShowModal]   = useState(false)
  const [selected, setSelected]     = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: w }, { data: cl }, { data: co }] = await Promise.all([
      supabase
        .from('work_orders')
        .select('*, clients(client_name), client_contracts(contract_number, contract_type)')
        .order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('client_contracts').select('id, contract_number, contract_type, client_id, clients(client_name)').eq('status', 'active'),
    ])
    setWOs(w || [])
    setClients(cl || [])
    setContracts(co || [])
    setLoading(false)
  }

  const filtered = wos.filter(w => {
    const q = search.toLowerCase()
    const matchSearch =
      w.wo_number?.toLowerCase().includes(q) ||
      w.clients?.client_name?.toLowerCase().includes(q) ||
      w.position?.toLowerCase().includes(q) ||
      w.internal_ref?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || w.status === filterStatus
    const matchClient = filterClient === 'all' || w.client_id === filterClient
    return matchSearch && matchStatus && matchClient
  })

  // Summary
  const summary = {
    total:     wos.length,
    active:    wos.filter(w => w.status === 'active').length,
    exhausting: wos.filter(w => {
      if (!w.po_value || w.po_value == 0) return false
      return (w.utilized_value / w.po_value * 100) >= w.alert_at_percent && w.status === 'active'
    }).length,
    expiring: wos.filter(w => {
      if (!w.end_date) return false
      const days = Math.ceil((new Date(w.end_date) - new Date()) / 86400000)
      return days >= 0 && days <= 14 && w.status === 'active'
    }).length,
    totalValue: wos.filter(w => w.status === 'active').reduce((s, w) => s + (+w.po_value || 0), 0),
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Work Orders / PO</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track client purchase orders — prevent unbilled deployments</p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Work Order
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SCard label="Total WOs"       value={summary.total}                         color="blue"   />
        <SCard label="Active"          value={summary.active}                        color="green"  />
        <SCard label="PO Exhausting"   value={summary.exhausting}  alert             color="red"    />
        <SCard label="Expiring (14d)"  value={summary.expiring}    alert             color="orange" />
      </div>

      {/* Active PO Value Banner */}
      {summary.totalValue > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Total Active PO Value</p>
            <p className="text-2xl font-bold text-blue-800 mt-0.5">₹{fmtFull(summary.totalValue)}</p>
          </div>
          <span className="text-4xl">📋</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search WO no, client, position..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={fetchAll}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No work orders found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['WO / PO No', 'Client', 'Position', 'Headcount', 'PO Value', 'Utilization', 'Valid Till', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(w => {
                const pct      = w.po_value > 0 ? Math.min((w.utilized_value / w.po_value) * 100, 100) : 0
                const isAlert  = pct >= w.alert_at_percent && w.status === 'active'
                const daysLeft = w.end_date ? Math.ceil((new Date(w.end_date) - new Date()) / 86400000) : null
                const isExpiring = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0

                return (
                  <tr key={w.id} className={`hover:bg-gray-50 transition-colors ${isAlert ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-blue-700">{w.wo_number}</p>
                      {w.internal_ref && <p className="text-xs text-gray-400">{w.internal_ref}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{w.clients?.client_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{w.position || '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-700 font-medium">{w.headcount}</td>
                    <td className="px-4 py-3">
                      {w.po_value > 0 ? (
                        <div>
                          <p className="font-semibold text-gray-800">₹{fmtFull(w.po_value)}</p>
                          <p className="text-xs text-gray-400">Rem: ₹{fmtFull(w.remaining_value)}</p>
                        </div>
                      ) : <span className="text-gray-400">Open</span>}
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      {w.po_value > 0 ? (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>₹{fmtShort(w.utilized_value)}</span>
                            <span className={isAlert ? 'text-red-600 font-bold' : ''}>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {isAlert && (
                            <p className="text-xs text-red-600 font-semibold mt-0.5">⚠️ Renewal needed</p>
                          )}
                        </div>
                      ) : <span className="text-xs text-gray-400">No PO value set</span>}
                    </td>
                    <td className="px-4 py-3">
                      {w.end_date ? (
                        <span className={`text-sm ${isExpiring ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          {w.end_date}
                          {isExpiring && <span className="block text-xs">({daysLeft}d left)</span>}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[w.status]?.color || 'bg-gray-100'}`}>
                        {STATUS_CONFIG[w.status]?.label || w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelected(w); setShowModal(true) }}
                        className="text-blue-600 hover:underline text-sm mr-3">Edit</button>
                      <button onClick={() => setSelected(w)}
                        className="text-gray-500 hover:text-gray-700 text-sm">View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <WOFormModal
          wo={selected}
          clients={clients}
          contracts={contracts}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }}
        />
      )}

      {/* Detail */}
      {selected && !showModal && (
        <WODetailDrawer
          wo={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setShowModal(true)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────
function SCard({ label, value, color, alert }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}{alert && value > 0 ? ' 🔴' : ''}</p>
      <p className="text-xs font-semibold mt-1 opacity-75 uppercase tracking-wide">{label}</p>
    </div>
  )
}

// ─── WO Form Modal ────────────────────────────────────────────
function WOFormModal({ wo, clients, contracts, onClose, onSaved }) {
  const isEdit    = !!wo?.id
  const [form, setForm]         = useState(isEdit ? { ...wo } : { ...EMPTY_FORM })
  const [clientId, setClientId] = useState(wo?.client_id || '')
  const [contractId, setContractId] = useState(wo?.contract_id || '')
  const [uploading, setUploading]   = useState(false)
  const [saving, setSaving]         = useState(false)

  // Filter contracts by selected client
  const clientContracts = contracts.filter(c => c.client_id === clientId)

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handlePOUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `work-orders/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('employee-documents').upload(path, file)
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data } = supabase.storage.from('employee-documents').getPublicUrl(path)
    setF('po_doc_url', data.publicUrl)
    setUploading(false)
  }

  async function handleSave() {
    if (!clientId)        { alert('Client select karo'); return }
    if (!form.wo_number)  { alert('WO/PO Number required'); return }
    if (!form.received_date) { alert('Received date required'); return }
    if (!form.start_date) { alert('Start date required'); return }

    setSaving(true)
    const payload = {
      ...form,
      client_id:   clientId,
      contract_id: contractId || null,
      po_value:    form.po_value    ? +form.po_value    : 0,
      headcount:   form.headcount   ? +form.headcount   : 1,
      alert_at_percent: +form.alert_at_percent || 80,
    }
    delete payload.clients
    delete payload.client_contracts
    delete payload.remaining_value   // generated column
    delete payload.id

    if (isEdit) {
      const { error } = await supabase.from('work_orders').update(payload).eq('id', wo.id)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      payload.utilized_value = 0
      const { error } = await supabase.from('work_orders').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit Work Order' : 'New Work Order'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Client */}
          <FRow label="Client *">
            <select value={clientId} onChange={e => { setClientId(e.target.value); setContractId('') }}
              className={inp}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </FRow>

          {/* Contract */}
          <FRow label="Link to Contract">
            <select value={contractId} onChange={e => setContractId(e.target.value)}
              className={inp} disabled={!clientId}>
              <option value="">Select contract (optional)...</option>
              {clientContracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.contract_number} — {c.contract_type}
                </option>
              ))}
            </select>
          </FRow>

          {/* WO Number */}
          <div className="grid grid-cols-2 gap-4">
            <FRow label="WO / PO Number *">
              <input className={inp} value={form.wo_number}
                onChange={e => setF('wo_number', e.target.value)}
                placeholder="e.g. PO-ABC-2026-01" />
            </FRow>
            <FRow label="Internal Ref">
              <input className={inp} value={form.internal_ref || ''}
                onChange={e => setF('internal_ref', e.target.value)}
                placeholder="e.g. WO-2026-001" />
            </FRow>
          </div>

          {/* Position & Headcount */}
          <div className="grid grid-cols-2 gap-4">
            <FRow label="Position">
              <input className={inp} value={form.position || ''}
                onChange={e => setF('position', e.target.value)}
                placeholder="e.g. Security Guard" />
            </FRow>
            <FRow label="Headcount">
              <input type="number" min="1" className={inp} value={form.headcount}
                onChange={e => setF('headcount', e.target.value)} />
            </FRow>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <FRow label="Received Date *">
              <input type="date" className={inp} value={form.received_date}
                onChange={e => setF('received_date', e.target.value)} />
            </FRow>
            <FRow label="Start Date *">
              <input type="date" className={inp} value={form.start_date}
                onChange={e => setF('start_date', e.target.value)} />
            </FRow>
            <FRow label="End Date">
              <input type="date" className={inp} value={form.end_date || ''}
                onChange={e => setF('end_date', e.target.value)} />
            </FRow>
          </div>

          {/* PO Value */}
          <div className="grid grid-cols-2 gap-4">
            <FRow label="PO Value (₹)">
              <input type="number" className={inp} value={form.po_value || ''}
                onChange={e => setF('po_value', e.target.value)}
                placeholder="0 = open-ended" />
            </FRow>
            <FRow label="Alert at (% utilized)">
              <select className={inp} value={form.alert_at_percent}
                onChange={e => setF('alert_at_percent', e.target.value)}>
                {[60, 70, 75, 80, 85, 90].map(p => (
                  <option key={p} value={p}>{p}%</option>
                ))}
              </select>
            </FRow>
          </div>

          {/* Status */}
          <FRow label="Status">
            <select className={inp} value={form.status}
              onChange={e => setF('status', e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </FRow>

          {/* PO Document Upload */}
          <FRow label="PO Document">
            <div className="flex items-center gap-3">
              <label className={`cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 ${uploading ? 'opacity-50' : ''}`}>
                {uploading ? 'Uploading...' : form.po_doc_url ? '✅ Uploaded — Replace' : '📎 Upload PO Copy'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  disabled={uploading} onChange={handlePOUpload} />
              </label>
              {form.po_doc_url && (
                <a href={form.po_doc_url} target="_blank" rel="noreferrer"
                  className="text-blue-600 hover:underline text-sm">View</a>
              )}
            </div>
          </FRow>

          {/* Notes */}
          <FRow label="Notes">
            <textarea className={inp} rows={2} value={form.notes || ''}
              onChange={e => setF('notes', e.target.value)}
              placeholder="Special conditions, amendment notes..." />
          </FRow>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Saving...' : isEdit ? 'Update WO' : 'Create WO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WO Detail Drawer ─────────────────────────────────────────
function WODetailDrawer({ wo, onClose, onEdit, onRefresh }) {
  const [deployments, setDeployments] = useState([])
  const [billingAmt, setBillingAmt]   = useState(0)
  const [addingBilling, setAddingBilling] = useState(false)
  const [billAmount, setBillAmount]   = useState('')
  const [billNote, setBillNote]       = useState('')

  useEffect(() => { fetchDeployments() }, [])

  async function fetchDeployments() {
    const { data } = await supabase
      .from('deployments')
      .select('*, employees(first_name, last_name)')
      .eq('work_order_id', wo.id)
    setDeployments(data || [])
  }

  async function addBillingEntry() {
    if (!billAmount) { alert('Amount required'); return }
    const newUtilized = (+wo.utilized_value || 0) + +billAmount
    const { error } = await supabase
      .from('work_orders')
      .update({ utilized_value: newUtilized })
      .eq('id', wo.id)
    if (error) { alert(error.message); return }
    alert(`✅ PO utilized value updated to ₹${fmtFull(newUtilized)}`)
    setAddingBilling(false)
    setBillAmount('')
    setBillNote('')
    onRefresh()
    onClose()
  }

  const pct = wo.po_value > 0 ? Math.min((wo.utilized_value / wo.po_value) * 100, 100) : 0
  const daysLeft = wo.end_date ? Math.ceil((new Date(wo.end_date) - new Date()) / 86400000) : null

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{wo.wo_number}</h2>
            <p className="text-sm text-gray-500">{wo.clients?.client_name}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[wo.status]?.color}`}>
              {STATUS_CONFIG[wo.status]?.label}
            </span>
            <button onClick={onEdit}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Edit</button>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Expiry alert */}
          {daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
              <span>🔴</span>
              <span>WO expires in <strong>{daysLeft} days</strong> ({wo.end_date}) — renew immediately!</span>
            </div>
          )}
          {daysLeft !== null && daysLeft < 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-gray-600 text-sm">
              <span>⏰</span>
              <span>WO expired on {wo.end_date}</span>
            </div>
          )}

          {/* PO Utilization */}
          {wo.po_value > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PO Utilization</p>
                <p className={`text-sm font-bold ${pct >= 90 ? 'text-red-600' : pct >= 80 ? 'text-orange-600' : 'text-green-600'}`}>
                  {pct.toFixed(1)}%
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div
                  className={`h-3 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-400">Total PO</p>
                  <p className="font-bold text-gray-800">₹{fmtFull(wo.po_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Utilized</p>
                  <p className="font-bold text-orange-600">₹{fmtFull(wo.utilized_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Remaining</p>
                  <p className="font-bold text-green-600">₹{fmtFull(wo.remaining_value)}</p>
                </div>
              </div>

              {/* Add billing entry */}
              {!addingBilling ? (
                <button onClick={() => setAddingBilling(true)}
                  className="mt-3 w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50">
                  + Update Utilized Amount
                </button>
              ) : (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Add to utilized value</p>
                  <input type="number" className={inp} placeholder="Amount (₹)"
                    value={billAmount} onChange={e => setBillAmount(e.target.value)} />
                  <input className={inp} placeholder="Note (invoice no, month...)"
                    value={billNote} onChange={e => setBillNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => setAddingBilling(false)}
                      className="flex-1 border border-gray-300 rounded-lg py-1.5 text-sm hover:bg-white">Cancel</button>
                    <button onClick={addBillingEntry}
                      className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700">Update</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <Section title="Work Order Details">
            <Grid2>
              <Detail label="Internal Ref"   value={wo.internal_ref || '—'} />
              <Detail label="Position"       value={wo.position || '—'} />
              <Detail label="Headcount"      value={wo.headcount} />
              <Detail label="Contract"       value={wo.client_contracts?.contract_number || '—'} />
              <Detail label="Received Date"  value={wo.received_date} />
              <Detail label="Start Date"     value={wo.start_date} />
              <Detail label="End Date"       value={wo.end_date || 'Open-ended'} />
              <Detail label="Alert Threshold" value={`${wo.alert_at_percent}%`} />
            </Grid2>
            {wo.notes && <p className="mt-3 text-sm text-gray-500 italic">{wo.notes}</p>}
          </Section>

          {/* PO Document */}
          {wo.po_doc_url && (
            <Section title="PO Document">
              <a href={wo.po_doc_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
                <span>📄</span> View PO Document
              </a>
            </Section>
          )}

          {/* Linked Deployments */}
          <Section title={`Linked Employees (${deployments.length})`}>
            {deployments.length === 0 ? (
              <p className="text-sm text-gray-400">No employees linked to this WO yet.</p>
            ) : (
              <div className="space-y-2">
                {deployments.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.employees?.first_name} {d.employees?.last_name}</p>
                      <p className="text-xs text-gray-400">{d.start_date} → {d.end_date || 'Ongoing'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.billing_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {d.billing_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function FRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function Grid2({ children }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  )
}

function fmtFull(n) {
  if (!n) return '0'
  return Number(n).toLocaleString('en-IN')
}

function fmtShort(n) {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K'
  return Number(n).toFixed(0)
}
