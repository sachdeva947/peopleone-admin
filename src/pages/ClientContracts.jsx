import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────
const CONTRACT_TYPES = [
  { value: 'payrolling',   label: 'Payrolling' },
  { value: 'flexi',        label: 'Flexi Staffing' },
  { value: 'rpo',          label: 'RPO' },
  { value: 'us_staffing',  label: 'US Staffing' },
  { value: 'permanent',    label: 'Permanent Placement' },
]

const STATUS_COLORS = {
  active:     'bg-green-100 text-green-800',
  draft:      'bg-gray-100 text-gray-600',
  expired:    'bg-red-100 text-red-800',
  terminated: 'bg-orange-100 text-orange-800',
}

const TYPE_COLORS = {
  payrolling:  'bg-blue-100 text-blue-800',
  flexi:       'bg-purple-100 text-purple-800',
  rpo:         'bg-yellow-100 text-yellow-800',
  us_staffing: 'bg-indigo-100 text-indigo-800',
  permanent:   'bg-green-100 text-green-800',
}

const EMPTY_CONTRACT = {
  contract_number: '',
  contract_type:   'payrolling',
  start_date:      '',
  end_date:        '',
  payment_terms:   'NET30',
  billing_cycle:   'monthly',
  currency:        'INR',
  credit_limit:    '',
  po_required:     true,
  gst_applicable:  true,
  gst_percent:     18,
  tds_applicable:  false,
  tds_percent:     2,
  status:          'active',
  notes:           '',
}

const EMPTY_POLICY = {
  leave_policy:           'actual_days',
  billable_leave_days:    0,
  el_billable:            false,
  sl_billable:            false,
  holiday_billable:       false,
  ot_billable:            false,
  ot_threshold_hrs:       8,
  ot_multiplier:          1.5,
  bench_billable:         false,
  bench_free_days:        0,
  working_days_per_month: 26,
}

// ─── Main Page ────────────────────────────────────────────────
export default function ClientContracts() {
  const [contracts, setContracts]   = useState([])
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal]   = useState(false)
  const [selected, setSelected]     = useState(null)  // contract for detail view

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase
        .from('client_contracts')
        .select('*, clients(client_name)')
        .order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setContracts(c || [])
    setClients(cl || [])
    setLoading(false)
  }

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch =
      c.contract_number?.toLowerCase().includes(q) ||
      c.clients?.client_name?.toLowerCase().includes(q)
    const matchType   = filterType   === 'all' || c.contract_type === filterType
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  // Summary cards
  const summary = {
    total:   contracts.length,
    active:  contracts.filter(c => c.status === 'active').length,
    poReqd:  contracts.filter(c => c.po_required && c.status === 'active').length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false
      const days = Math.ceil((new Date(c.end_date) - new Date()) / 86400000)
      return days > 0 && days <= 30
    }).length,
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Client Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage billing policies, rates & work order rules</p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Contract
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Contracts" value={summary.total}   color="blue"   />
        <SummaryCard label="Active"          value={summary.active}  color="green"  />
        <SummaryCard label="PO Mandatory"    value={summary.poReqd}  color="purple" />
        <SummaryCard label="Expiring (30d)"  value={summary.expiring} color="red"   />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search client or contract no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All Types</option>
          {CONTRACT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
        <button onClick={fetchAll} className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No contracts found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Contract No', 'Client', 'Type', 'Billing Cycle', 'Payment Terms',
                  'PO Reqd', 'Valid Till', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(c => {
                const daysLeft = c.end_date
                  ? Math.ceil((new Date(c.end_date) - new Date()) / 86400000)
                  : null
                const isExpiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft > 0

                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-blue-700 font-medium">
                      {c.contract_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.clients?.client_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.contract_type] || 'bg-gray-100 text-gray-600'}`}>
                        {CONTRACT_TYPES.find(t => t.value === c.contract_type)?.label || c.contract_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.billing_cycle}</td>
                    <td className="px-4 py-3 text-gray-600">{c.payment_terms}</td>
                    <td className="px-4 py-3">
                      {c.po_required
                        ? <span className="text-green-600 font-medium">✓ Yes</span>
                        : <span className="text-gray-400">No</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.end_date ? (
                        <span className={isExpiringSoon ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {c.end_date}
                          {isExpiringSoon && <span className="ml-1 text-xs">({daysLeft}d)</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">Open-ended</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(c)}
                        className="text-blue-600 hover:underline text-sm mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { setSelected(c); setShowModal(true) }}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <ContractFormModal
          contract={selected}
          clients={clients}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }}
        />
      )}

      {/* Detail Drawer */}
      {selected && !showModal && (
        <ContractDetailDrawer
          contract={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setShowModal(true)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────
function SummaryCard({ label, value, color }) {
  const colors = {
    blue:   'border-blue-200 bg-blue-50 text-blue-700',
    green:  'border-green-200 bg-green-50 text-green-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    red:    'border-red-200 bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

// ─── Contract Form Modal ──────────────────────────────────────
function ContractFormModal({ contract, clients, onClose, onSaved }) {
  const isEdit = !!contract?.id
  const [tab, setTab]         = useState('basic')
  const [form, setForm]       = useState(isEdit ? { ...contract } : { ...EMPTY_CONTRACT })
  const [policy, setPolicy]   = useState(EMPTY_POLICY)
  const [rates, setRates]     = useState([])         // bill rates rows
  const [saving, setSaving]   = useState(false)
  const [clientId, setClientId] = useState(contract?.client_id || '')

  useEffect(() => {
    if (isEdit) {
      fetchPolicy()
      fetchRates()
    }
  }, [])

  async function fetchPolicy() {
    const { data } = await supabase
      .from('contract_billing_policy')
      .select('*')
      .eq('contract_id', contract.id)
      .maybeSingle()
    if (data) setPolicy(data)
  }

  async function fetchRates() {
    const { data } = await supabase
      .from('contract_bill_rates')
      .select('*')
      .eq('contract_id', contract.id)
      .order('created_at')
    setRates(data || [])
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setP(k, v) { setPolicy(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    if (!clientId)              { alert('Client select karo'); return }
    if (!form.contract_number)  { alert('Contract number required'); return }
    if (!form.start_date)       { alert('Start date required'); return }

    setSaving(true)
    const payload = { ...form, client_id: clientId }
    delete payload.clients   // joined field
    delete payload.id

    let contractId = contract?.id

    if (isEdit) {
      const { error } = await supabase
        .from('client_contracts')
        .update(payload)
        .eq('id', contractId)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('client_contracts')
        .insert(payload)
        .select()
        .single()
      if (error) { alert(error.message); setSaving(false); return }
      contractId = data.id
    }

    // Save billing policy
    const policyPayload = { ...policy, contract_id: contractId }
    delete policyPayload.id
    delete policyPayload.created_at
    if (isEdit && policy.id) {
      await supabase.from('contract_billing_policy').update(policyPayload).eq('id', policy.id)
    } else {
      await supabase.from('contract_billing_policy').insert(policyPayload)
    }

    setSaving(false)
    onSaved()
  }

  const tabs = [
    { key: 'basic',  label: 'Basic Info' },
    { key: 'policy', label: 'Billing Policy' },
    { key: 'rates',  label: 'Bill Rates' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit Contract' : 'New Contract'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── Tab: Basic Info ── */}
          {tab === 'basic' && (
            <>
              <Row label="Client *">
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className={input}
                >
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.client_name}</option>
                  ))}
                </select>
              </Row>

              <Row label="Contract Number *">
                <input className={input} value={form.contract_number}
                  onChange={e => setF('contract_number', e.target.value)}
                  placeholder="e.g. CNT-2026-001" />
              </Row>

              <div className="grid grid-cols-2 gap-4">
                <Row label="Contract Type">
                  <select className={input} value={form.contract_type}
                    onChange={e => setF('contract_type', e.target.value)}>
                    {CONTRACT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Status">
                  <select className={input} value={form.status}
                    onChange={e => setF('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </Row>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Row label="Start Date *">
                  <input type="date" className={input} value={form.start_date}
                    onChange={e => setF('start_date', e.target.value)} />
                </Row>
                <Row label="End Date">
                  <input type="date" className={input} value={form.end_date || ''}
                    onChange={e => setF('end_date', e.target.value)} />
                </Row>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Row label="Billing Cycle">
                  <select className={input} value={form.billing_cycle}
                    onChange={e => setF('billing_cycle', e.target.value)}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                    <option value="milestone">Milestone</option>
                  </select>
                </Row>
                <Row label="Payment Terms">
                  <select className={input} value={form.payment_terms}
                    onChange={e => setF('payment_terms', e.target.value)}>
                    {['IMMEDIATE','NET15','NET30','NET45','NET60'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Row>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Row label="Currency">
                  <select className={input} value={form.currency}
                    onChange={e => setF('currency', e.target.value)}>
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                    <option value="GBP">GBP £</option>
                    <option value="AED">AED د.إ</option>
                  </select>
                </Row>
                <Row label="Credit Limit">
                  <input type="number" className={input} value={form.credit_limit || ''}
                    onChange={e => setF('credit_limit', e.target.value)}
                    placeholder="0" />
                </Row>
              </div>

              {/* Toggles */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <Toggle label="Work Order / PO Mandatory" checked={form.po_required}
                  onChange={v => setF('po_required', v)} />
                <Toggle label="GST Applicable" checked={form.gst_applicable}
                  onChange={v => setF('gst_applicable', v)} />
                {form.gst_applicable && (
                  <Row label="GST %">
                    <input type="number" className={inputSm} value={form.gst_percent}
                      onChange={e => setF('gst_percent', e.target.value)} />
                  </Row>
                )}
                <Toggle label="TDS Applicable" checked={form.tds_applicable}
                  onChange={v => setF('tds_applicable', v)} />
                {form.tds_applicable && (
                  <Row label="TDS %">
                    <input type="number" className={inputSm} value={form.tds_percent}
                      onChange={e => setF('tds_percent', e.target.value)} />
                  </Row>
                )}
              </div>

              <Row label="Notes">
                <textarea className={input} rows={2} value={form.notes || ''}
                  onChange={e => setF('notes', e.target.value)}
                  placeholder="Special terms, remarks..." />
              </Row>
            </>
          )}

          {/* ── Tab: Billing Policy ── */}
          {tab === 'policy' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                💡 These rules determine what you bill vs what you pay — critical for margin tracking.
              </div>

              <Row label="Leave Billing Policy">
                <select className={input} value={policy.leave_policy}
                  onChange={e => setP('leave_policy', e.target.value)}>
                  <option value="actual_days">Actual Days Only — client pays only worked days</option>
                  <option value="fixed_monthly">Fixed Monthly — client pays full month always</option>
                  <option value="contracted_days">Contracted Days — fixed 26 days always</option>
                </select>
              </Row>

              {policy.leave_policy === 'actual_days' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ Leave days will be absorbed by your company — tracked as cost leakage.
                </div>
              )}

              <Row label="Billable Leave Days / month">
                <input type="number" className={inputSm} value={policy.billable_leave_days}
                  onChange={e => setP('billable_leave_days', +e.target.value)}
                  placeholder="0" />
                <span className="text-xs text-gray-400 mt-1">
                  Leave days you can bill to client (0 = none)
                </span>
              </Row>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Types</p>
                <Toggle label="Earned Leave (EL) billable to client" checked={policy.el_billable}
                  onChange={v => setP('el_billable', v)} />
                <Toggle label="Sick Leave (SL) billable to client" checked={policy.sl_billable}
                  onChange={v => setP('sl_billable', v)} />
                <Toggle label="Public Holidays billable to client" checked={policy.holiday_billable}
                  onChange={v => setP('holiday_billable', v)} />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overtime</p>
                <Toggle label="OT Billable to Client" checked={policy.ot_billable}
                  onChange={v => setP('ot_billable', v)} />
                {policy.ot_billable && (
                  <div className="grid grid-cols-2 gap-4">
                    <Row label="OT after (hrs/day)">
                      <input type="number" className={inputSm} value={policy.ot_threshold_hrs}
                        onChange={e => setP('ot_threshold_hrs', +e.target.value)} />
                    </Row>
                    <Row label="OT Multiplier">
                      <input type="number" step="0.5" className={inputSm} value={policy.ot_multiplier}
                        onChange={e => setP('ot_multiplier', +e.target.value)}
                        placeholder="1.5" />
                    </Row>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bench</p>
                <Toggle label="Bench Period Billable" checked={policy.bench_billable}
                  onChange={v => setP('bench_billable', v)} />
                <Row label="Bench Free Days (grace)">
                  <input type="number" className={inputSm} value={policy.bench_free_days}
                    onChange={e => setP('bench_free_days', +e.target.value)} />
                </Row>
              </div>

              <Row label="Working Days / Month">
                <input type="number" className={inputSm} value={policy.working_days_per_month}
                  onChange={e => setP('working_days_per_month', +e.target.value)} />
              </Row>
            </>
          )}

          {/* ── Tab: Bill Rates ── */}
          {tab === 'rates' && (
            <BillRatesTab
              contractId={contract?.id}
              rates={rates}
              currency={form.currency}
              onRefresh={fetchRates}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Saving...' : isEdit ? 'Update Contract' : 'Create Contract'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bill Rates Tab ───────────────────────────────────────────
function BillRatesTab({ contractId, rates, currency, onRefresh }) {
  const [adding, setAdding] = useState(false)
  const [newRate, setNewRate] = useState({
    position: '', skill_level: '', bill_rate: '',
    bill_rate_unit: 'monthly', pay_rate: '', effective_from: '',
  })

  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '₹'

  function calcMarkup(bill, pay) {
    if (!bill || !pay || pay == 0) return '—'
    return (((bill - pay) / bill) * 100).toFixed(1) + '%'
  }

  async function addRate() {
    if (!contractId) { alert('Contract save karo pehle (Basic Info tab)'); return }
    if (!newRate.position || !newRate.bill_rate || !newRate.effective_from) {
      alert('Position, Bill Rate aur Effective From required hain')
      return
    }
    const markup = newRate.bill_rate && newRate.pay_rate
      ? ((newRate.bill_rate - newRate.pay_rate) / newRate.bill_rate * 100).toFixed(2)
      : null

    const { error } = await supabase.from('contract_bill_rates').insert({
      contract_id:    contractId,
      position:       newRate.position,
      skill_level:    newRate.skill_level,
      bill_rate:      +newRate.bill_rate,
      bill_rate_unit: newRate.bill_rate_unit,
      pay_rate:       newRate.pay_rate ? +newRate.pay_rate : null,
      markup_percent: markup ? +markup : null,
      currency,
      effective_from: newRate.effective_from,
    })
    if (error) { alert(error.message); return }
    setNewRate({ position: '', skill_level: '', bill_rate: '', bill_rate_unit: 'monthly', pay_rate: '', effective_from: '' })
    setAdding(false)
    onRefresh()
  }

  async function deleteRate(id) {
    if (!confirm('Delete this rate?')) return
    await supabase.from('contract_bill_rates').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Define bill rates per position / skill level.</p>
        <button onClick={() => setAdding(!adding)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
          + Add Rate
        </button>
      </div>

      {/* Add Rate Form */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Row label="Position *">
              <input className={input} value={newRate.position}
                onChange={e => setNewRate(r => ({ ...r, position: e.target.value }))}
                placeholder="e.g. Security Guard" />
            </Row>
            <Row label="Skill Level">
              <input className={input} value={newRate.skill_level}
                onChange={e => setNewRate(r => ({ ...r, skill_level: e.target.value }))}
                placeholder="Junior / Senior" />
            </Row>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Row label={`Bill Rate (${sym}) *`}>
              <input type="number" className={input} value={newRate.bill_rate}
                onChange={e => setNewRate(r => ({ ...r, bill_rate: e.target.value }))} />
            </Row>
            <Row label={`Pay Rate (${sym})`}>
              <input type="number" className={input} value={newRate.pay_rate}
                onChange={e => setNewRate(r => ({ ...r, pay_rate: e.target.value }))}
                placeholder="Optional" />
            </Row>
            <Row label="Unit">
              <select className={input} value={newRate.bill_rate_unit}
                onChange={e => setNewRate(r => ({ ...r, bill_rate_unit: e.target.value }))}>
                <option value="hourly">Per Hour</option>
                <option value="daily">Per Day</option>
                <option value="monthly">Per Month</option>
              </select>
            </Row>
          </div>
          <Row label="Effective From *">
            <input type="date" className={inputSm} value={newRate.effective_from}
              onChange={e => setNewRate(r => ({ ...r, effective_from: e.target.value }))} />
          </Row>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={addRate}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Save Rate
            </button>
          </div>
        </div>
      )}

      {/* Rates Table */}
      {rates.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No rates added yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Position', 'Level', 'Bill Rate', 'Pay Rate', 'Markup', 'Unit', 'From', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.position}</td>
                  <td className="px-3 py-2 text-gray-500">{r.skill_level || '—'}</td>
                  <td className="px-3 py-2 text-green-700 font-semibold">{sym}{Number(r.bill_rate).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-600">{r.pay_rate ? `${sym}${Number(r.pay_rate).toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium ${+calcMarkup(r.bill_rate, r.pay_rate) < 10 ? 'text-red-600' : 'text-green-700'}`}>
                      {calcMarkup(r.bill_rate, r.pay_rate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 capitalize">{r.bill_rate_unit}</td>
                  <td className="px-3 py-2 text-gray-500">{r.effective_from}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => deleteRate(r.id)} className="text-red-400 hover:text-red-600 text-xs">
                      Delete
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

// ─── Contract Detail Drawer ───────────────────────────────────
function ContractDetailDrawer({ contract, onClose, onEdit, onRefresh }) {
  const [policy, setPolicy]   = useState(null)
  const [rates, setRates]     = useState([])
  const [workOrders, setWOs]  = useState([])

  useEffect(() => { fetchDetails() }, [])

  async function fetchDetails() {
    const [{ data: p }, { data: r }, { data: w }] = await Promise.all([
      supabase.from('contract_billing_policy').select('*').eq('contract_id', contract.id).maybeSingle(),
      supabase.from('contract_bill_rates').select('*').eq('contract_id', contract.id).order('effective_from'),
      supabase.from('work_orders').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false }),
    ])
    setPolicy(p)
    setRates(r || [])
    setWOs(w || [])
  }

  const sym = contract.currency === 'USD' ? '$' : contract.currency === 'GBP' ? '£' : '₹'

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{contract.contract_number}</h2>
            <p className="text-sm text-gray-500">{contract.clients?.client_name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
              Edit
            </button>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Basic Info */}
          <Section title="Contract Details">
            <Grid2>
              <Detail label="Type" value={CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label} />
              <Detail label="Status">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status]}`}>
                  {contract.status}
                </span>
              </Detail>
              <Detail label="Start Date"    value={contract.start_date} />
              <Detail label="End Date"      value={contract.end_date || 'Open-ended'} />
              <Detail label="Billing Cycle" value={contract.billing_cycle} />
              <Detail label="Payment Terms" value={contract.payment_terms} />
              <Detail label="Currency"      value={contract.currency} />
              <Detail label="Credit Limit"  value={contract.credit_limit ? `${sym}${Number(contract.credit_limit).toLocaleString()}` : '—'} />
              <Detail label="PO Required"   value={contract.po_required ? 'Yes' : 'No'} />
              <Detail label="GST"           value={contract.gst_applicable ? `${contract.gst_percent}%` : 'No'} />
              <Detail label="TDS"           value={contract.tds_applicable ? `${contract.tds_percent}%` : 'No'} />
            </Grid2>
            {contract.notes && <p className="mt-3 text-sm text-gray-500 italic">{contract.notes}</p>}
          </Section>

          {/* Billing Policy */}
          {policy && (
            <Section title="Billing Policy">
              <Grid2>
                <Detail label="Leave Policy"      value={policy.leave_policy?.replace(/_/g, ' ')} />
                <Detail label="Billable Leaves"   value={`${policy.billable_leave_days} days/month`} />
                <Detail label="EL Billable"       value={policy.el_billable ? 'Yes' : 'No'} />
                <Detail label="SL Billable"       value={policy.sl_billable ? 'Yes' : 'No'} />
                <Detail label="Holidays Billable" value={policy.holiday_billable ? 'Yes' : 'No'} />
                <Detail label="OT Billable"       value={policy.ot_billable ? `Yes (${policy.ot_multiplier}x after ${policy.ot_threshold_hrs}h)` : 'No'} />
                <Detail label="Bench Billable"    value={policy.bench_billable ? 'Yes' : `No (${policy.bench_free_days}d grace)`} />
                <Detail label="Working Days"      value={`${policy.working_days_per_month} days/month`} />
              </Grid2>
            </Section>
          )}

          {/* Bill Rates */}
          {rates.length > 0 && (
            <Section title="Bill Rates">
              <div className="space-y-2">
                {rates.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-sm text-gray-900">{r.position}</span>
                      {r.skill_level && <span className="text-xs text-gray-400 ml-2">({r.skill_level})</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">{sym}{Number(r.bill_rate).toLocaleString()} / {r.bill_rate_unit}</p>
                      {r.pay_rate && (
                        <p className="text-xs text-gray-400">Pay: {sym}{Number(r.pay_rate).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Work Orders */}
          <Section title={`Work Orders (${workOrders.length})`}>
            {workOrders.length === 0 ? (
              <p className="text-sm text-gray-400">No work orders linked.</p>
            ) : (
              <div className="space-y-2">
                {workOrders.map(wo => {
                  const pct = wo.po_value > 0 ? (wo.utilized_value / wo.po_value * 100).toFixed(0) : 0
                  return (
                    <div key={wo.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{wo.wo_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          wo.status === 'active' ? 'bg-green-100 text-green-700' :
                          wo.status === 'expired' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{wo.status}</span>
                      </div>
                      {wo.po_value > 0 && (
                        <>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Used: {sym}{Number(wo.utilized_value).toLocaleString()}</span>
                            <span>Total: {sym}{Number(wo.po_value).toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${+pct >= 80 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-right text-gray-400 mt-0.5">{pct}% utilized</p>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
const input   = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
const inputSm = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[180px]'

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </div>
    </label>
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

function Detail({ label, value, children }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 capitalize">{children || value || '—'}</p>
    </div>
  )
}
