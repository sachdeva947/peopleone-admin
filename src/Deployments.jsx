import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────
const BILLING_STATUS = {
  active:  { label: 'Active',    color: 'bg-green-100 text-green-800'   },
  bench:   { label: 'Bench',     color: 'bg-yellow-100 text-yellow-800' },
  on_hold: { label: 'On Hold',   color: 'bg-orange-100 text-orange-800' },
  closed:  { label: 'Closed',    color: 'bg-gray-100 text-gray-600'     },
}

const DEPLOY_TYPES = {
  payrolling:  { label: 'Payrolling',   color: 'bg-blue-100 text-blue-800'   },
  flexi:       { label: 'Flexi',        color: 'bg-purple-100 text-purple-800'},
  us_staffing: { label: 'US Staffing',  color: 'bg-indigo-100 text-indigo-800'},
}

const EMPTY_FORM = {
  start_date:       '',
  end_date:         '',
  bill_rate:        '',
  bill_rate_unit:   'monthly',
  pay_rate:         '',
  deployment_type:  'payrolling',
  billing_status:   'active',
  bench_since:      '',
  notes:            '',
}

// ─── Main Page ────────────────────────────────────────────────
export default function Deployments() {
  const [deployments, setDeployments] = useState([])
  const [employees, setEmployees]     = useState([])
  const [clients, setClients]         = useState([])
  const [workOrders, setWorkOrders]   = useState([])
  const [contracts, setContracts]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilter]     = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [showModal, setShowModal]     = useState(false)
  const [selected, setSelected]       = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: d }, { data: e }, { data: cl }, { data: wo }, { data: co }] = await Promise.all([
      supabase
        .from('deployments')
        .select('*, employees(first_name, last_name, employee_code, designation), clients(client_name), work_orders(wo_number, po_value, remaining_value), client_contracts(contract_number, contract_type)')
        .order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_code, designation').eq('status', 'active').order('first_name'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('work_orders').select('id, wo_number, client_id, contract_id, po_value, remaining_value, status').eq('status', 'active'),
      supabase.from('client_contracts').select('id, contract_number, contract_type, client_id').eq('status', 'active'),
    ])
    setDeployments(d || [])
    setEmployees(e || [])
    setClients(cl || [])
    setWorkOrders(wo || [])
    setContracts(co || [])
    setLoading(false)
  }

  const filtered = deployments.filter(d => {
    const q = search.toLowerCase()
    const matchSearch =
      `${d.employees?.first_name} ${d.employees?.last_name}`.toLowerCase().includes(q) ||
      d.employees?.employee_code?.toLowerCase().includes(q) ||
      d.clients?.client_name?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || d.billing_status === filterStatus
    const matchClient = filterClient === 'all' || d.client_id === filterClient
    return matchSearch && matchStatus && matchClient
  })

  // Summary
  const summary = {
    total:    deployments.length,
    active:   deployments.filter(d => d.billing_status === 'active').length,
    bench:    deployments.filter(d => d.billing_status === 'bench').length,
    noWO:     deployments.filter(d => !d.work_order_id && d.billing_status === 'active').length,
  }

  // Bench cost calculation
  const totalBenchCost = deployments
    .filter(d => d.billing_status === 'bench' && d.bench_since && d.pay_rate)
    .reduce((sum, d) => {
      const days = Math.max(0, Math.ceil((new Date() - new Date(d.bench_since)) / 86400000))
      const dailyRate = d.bill_rate_unit === 'monthly' ? d.pay_rate / 26 : d.pay_rate
      return sum + (days * dailyRate)
    }, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Deployments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Employee ↔ Client ↔ Work Order mapping</p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Deployment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SCard label="Total"          value={summary.total}  color="blue"   />
        <SCard label="Active Billing" value={summary.active} color="green"  />
        <SCard label="On Bench"       value={summary.bench}  color="yellow" extra={totalBenchCost > 0 ? `₹${fmtShort(totalBenchCost)} cost` : ''} />
        <SCard label="No Work Order 🔴" value={summary.noWO} color="red"   />
      </div>

      {/* No WO Alert Banner */}
      {summary.noWO > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <span className="text-xl">🔴</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {summary.noWO} active deployment{summary.noWO > 1 ? 's' : ''} without a Work Order!
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              These are unbillable until a WO is linked — revenue leakage risk.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search employee, client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All Status</option>
          {Object.entries(BILLING_STATUS).map(([k, v]) => (
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
        <div className="text-center py-16 text-gray-400">No deployments found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Client', 'Type', 'Bill Rate', 'Pay Rate', 'Margin', 'Work Order', 'Start Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(d => {
                const margin = d.bill_rate && d.pay_rate
                  ? (((d.bill_rate - d.pay_rate) / d.bill_rate) * 100).toFixed(1)
                  : null
                const marginColor = margin
                  ? +margin >= 15 ? 'text-green-700' : +margin >= 10 ? 'text-yellow-700' : 'text-red-700'
                  : 'text-gray-400'
                const noWO = !d.work_order_id && d.billing_status === 'active'
                const benchDays = d.bench_since
                  ? Math.ceil((new Date() - new Date(d.bench_since)) / 86400000)
                  : null

                return (
                  <tr key={d.id} className={`hover:bg-gray-50 transition-colors ${noWO ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.employees?.first_name} {d.employees?.last_name}</p>
                      <p className="text-xs text-gray-400">{d.employees?.employee_code} · {d.employees?.designation}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.clients?.client_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DEPLOY_TYPES[d.deployment_type]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {DEPLOY_TYPES[d.deployment_type]?.label || d.deployment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {d.bill_rate ? `₹${Number(d.bill_rate).toLocaleString('en-IN')}` : '—'}
                      <span className="text-xs text-gray-400 font-normal ml-1">/{d.bill_rate_unit?.replace('ly','')}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.pay_rate ? `₹${Number(d.pay_rate).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className={`px-4 py-3 font-bold ${marginColor}`}>
                      {margin ? `${margin}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.work_orders ? (
                        <div>
                          <p className="text-xs font-mono text-blue-700">{d.work_orders.wo_number}</p>
                          {d.work_orders.po_value > 0 && (
                            <p className="text-xs text-gray-400">Rem: ₹{fmtShort(d.work_orders.remaining_value)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-red-600">⚠️ No WO</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{d.start_date}</p>
                      {d.billing_status === 'bench' && benchDays !== null && (
                        <p className="text-xs text-yellow-700 font-medium">Bench {benchDays}d</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BILLING_STATUS[d.billing_status]?.color || ''}`}>
                        {BILLING_STATUS[d.billing_status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelected(d); setShowModal(true) }}
                        className="text-blue-600 hover:underline text-sm mr-2">Edit</button>
                      <button onClick={() => setSelected(d)}
                        className="text-gray-500 hover:text-gray-700 text-sm">View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DeploymentFormModal
          deployment={selected}
          employees={employees}
          clients={clients}
          workOrders={workOrders}
          contracts={contracts}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }}
        />
      )}

      {selected && !showModal && (
        <DeploymentDetailDrawer
          deployment={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setShowModal(true)}
          onStatusChange={async (id, status) => {
            const update = { billing_status: status }
            if (status === 'bench') update.bench_since = new Date().toISOString().split('T')[0]
            if (status === 'active') update.bench_since = null
            await supabase.from('deployments').update(update).eq('id', id)
            fetchAll()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────
function SCard({ label, value, color, extra }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red:    'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold mt-1 opacity-75 uppercase tracking-wide">{label}</p>
      {extra && <p className="text-xs mt-0.5 opacity-60">{extra}</p>}
    </div>
  )
}

// ─── Deployment Form Modal ────────────────────────────────────
function DeploymentFormModal({ deployment, employees, clients, workOrders, contracts, onClose, onSaved }) {
  const isEdit = !!deployment?.id
  const [form, setForm]           = useState(isEdit ? { ...deployment } : { ...EMPTY_FORM })
  const [employeeId, setEmployeeId] = useState(deployment?.employee_id || '')
  const [clientId, setClientId]   = useState(deployment?.client_id || '')
  const [woId, setWoId]           = useState(deployment?.work_order_id || '')
  const [contractId, setContractId] = useState(deployment?.contract_id || '')
  const [saving, setSaving]       = useState(false)

  const clientWOs        = workOrders.filter(w => w.client_id === clientId)
  const clientContracts  = contracts.filter(c => c.client_id === clientId)

  // Auto-fill bill rate from contract rates when contract selected
  useEffect(() => {
    if (contractId && !isEdit) autoFillRate()
  }, [contractId])

  async function autoFillRate() {
    const { data } = await supabase
      .from('contract_bill_rates')
      .select('bill_rate, pay_rate, bill_rate_unit')
      .eq('contract_id', contractId)
      .limit(1)
      .maybeSingle()
    if (data) {
      setForm(f => ({
        ...f,
        bill_rate:      data.bill_rate,
        pay_rate:       data.pay_rate || '',
        bill_rate_unit: data.bill_rate_unit,
      }))
    }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const margin = form.bill_rate && form.pay_rate
    ? (((form.bill_rate - form.pay_rate) / form.bill_rate) * 100).toFixed(1)
    : null

  async function handleSave() {
    if (!employeeId) { alert('Employee select karo'); return }
    if (!clientId)   { alert('Client select karo'); return }
    if (!form.start_date) { alert('Start date required'); return }
    if (!form.bill_rate)  { alert('Bill rate required'); return }

    setSaving(true)
    const payload = {
      ...form,
      employee_id:  employeeId,
      client_id:    clientId,
      work_order_id: woId || null,
      contract_id:   contractId || null,
      bill_rate:     +form.bill_rate,
      pay_rate:      form.pay_rate ? +form.pay_rate : null,
      bench_since:   form.billing_status === 'bench' ? (form.bench_since || new Date().toISOString().split('T')[0]) : null,
    }
    delete payload.employees
    delete payload.clients
    delete payload.work_orders
    delete payload.client_contracts
    delete payload.id

    if (isEdit) {
      const { error } = await supabase.from('deployments').update(payload).eq('id', deployment.id)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('deployments').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit Deployment' : 'New Deployment'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Employee */}
          <FRow label="Employee *">
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className={inp}>
              <option value="">Select employee...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} {e.employee_code ? `(${e.employee_code})` : ''} {e.designation ? `— ${e.designation}` : ''}
                </option>
              ))}
            </select>
          </FRow>

          {/* Client */}
          <FRow label="Client *">
            <select value={clientId} onChange={e => { setClientId(e.target.value); setWoId(''); setContractId('') }} className={inp}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </FRow>

          {/* Contract */}
          <FRow label="Contract">
            <select value={contractId} onChange={e => setContractId(e.target.value)} className={inp} disabled={!clientId}>
              <option value="">Select contract...</option>
              {clientContracts.map(c => (
                <option key={c.id} value={c.id}>{c.contract_number} — {c.contract_type}</option>
              ))}
            </select>
            {contractId && <p className="text-xs text-blue-600 mt-1">Bill rates will auto-fill from contract</p>}
          </FRow>

          {/* Work Order */}
          <FRow label="Work Order">
            <select value={woId} onChange={e => setWoId(e.target.value)} className={inp} disabled={!clientId}>
              <option value="">Select work order...</option>
              {clientWOs.map(w => (
                <option key={w.id} value={w.id}>
                  {w.wo_number} {w.po_value > 0 ? `— Rem: ₹${fmtShort(w.remaining_value)}` : ''}
                </option>
              ))}
            </select>
            {!woId && clientId && (
              <p className="text-xs text-red-500 mt-1">⚠️ No WO = unbillable deployment (leakage risk)</p>
            )}
          </FRow>

          {/* Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <FRow label="Deployment Type">
              <select value={form.deployment_type} onChange={e => setF('deployment_type', e.target.value)} className={inp}>
                {Object.entries(DEPLOY_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </FRow>
            <FRow label="Billing Status">
              <select value={form.billing_status} onChange={e => setF('billing_status', e.target.value)} className={inp}>
                {Object.entries(BILLING_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </FRow>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <FRow label="Start Date *">
              <input type="date" className={inp} value={form.start_date}
                onChange={e => setF('start_date', e.target.value)} />
            </FRow>
            <FRow label="End Date">
              <input type="date" className={inp} value={form.end_date || ''}
                onChange={e => setF('end_date', e.target.value)} />
            </FRow>
          </div>

          {/* Bench Since */}
          {form.billing_status === 'bench' && (
            <FRow label="Bench Since">
              <input type="date" className={inp} value={form.bench_since || ''}
                onChange={e => setF('bench_since', e.target.value)} />
            </FRow>
          )}

          {/* Bill Rate & Pay Rate */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rates & Margin</p>
            <div className="grid grid-cols-3 gap-3">
              <FRow label="Bill Rate *">
                <input type="number" className={inp} value={form.bill_rate || ''}
                  onChange={e => setF('bill_rate', e.target.value)} placeholder="0" />
              </FRow>
              <FRow label="Pay Rate">
                <input type="number" className={inp} value={form.pay_rate || ''}
                  onChange={e => setF('pay_rate', e.target.value)} placeholder="0" />
              </FRow>
              <FRow label="Unit">
                <select className={inp} value={form.bill_rate_unit}
                  onChange={e => setF('bill_rate_unit', e.target.value)}>
                  <option value="hourly">Per Hour</option>
                  <option value="daily">Per Day</option>
                  <option value="monthly">Per Month</option>
                </select>
              </FRow>
            </div>
            {margin !== null && (
              <div className={`flex items-center gap-2 text-sm font-semibold ${+margin >= 15 ? 'text-green-700' : +margin >= 10 ? 'text-yellow-700' : 'text-red-700'}`}>
                <span>Margin: {margin}%</span>
                <span>{+margin >= 15 ? '✅ Healthy' : +margin >= 10 ? '⚠️ Watch' : '🔴 Critical'}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <FRow label="Notes">
            <textarea className={inp} rows={2} value={form.notes || ''}
              onChange={e => setF('notes', e.target.value)}
              placeholder="Additional details..." />
          </FRow>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Deployment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Deployment Detail Drawer ─────────────────────────────────
function DeploymentDetailDrawer({ deployment: d, onClose, onEdit, onStatusChange }) {
  const margin = d.bill_rate && d.pay_rate
    ? (((d.bill_rate - d.pay_rate) / d.bill_rate) * 100).toFixed(1)
    : null
  const marginColor = margin
    ? +margin >= 15 ? 'text-green-700' : +margin >= 10 ? 'text-yellow-700' : 'text-red-700'
    : 'text-gray-400'

  const benchDays = d.bench_since
    ? Math.ceil((new Date() - new Date(d.bench_since)) / 86400000)
    : null

  const benchCost = benchDays && d.pay_rate
    ? (benchDays * (d.bill_rate_unit === 'monthly' ? d.pay_rate / 26 : d.pay_rate)).toFixed(0)
    : null

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{d.employees?.first_name} {d.employees?.last_name}</h2>
            <p className="text-sm text-gray-500">{d.clients?.client_name}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${BILLING_STATUS[d.billing_status]?.color}`}>
              {BILLING_STATUS[d.billing_status]?.label}
            </span>
            <button onClick={onEdit}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Edit</button>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* No WO Alert */}
          {!d.work_order_id && d.billing_status === 'active' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex gap-2">
              <span>🔴</span>
              <span>No Work Order linked — this deployment cannot be billed. Link a WO to fix leakage.</span>
            </div>
          )}

          {/* Bench Cost Alert */}
          {d.billing_status === 'bench' && benchDays !== null && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-yellow-800">On Bench — {benchDays} days</p>
              {benchCost && (
                <p className="text-sm text-yellow-700 mt-0.5">
                  Estimated bench cost: ₹{Number(benchCost).toLocaleString('en-IN')} absorbed
                </p>
              )}
            </div>
          )}

          {/* Margin Card */}
          {margin && (
            <div className={`border rounded-xl p-4 ${+margin >= 15 ? 'bg-green-50 border-green-200' : +margin >= 10 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Gross Margin</p>
              <p className={`text-3xl font-bold mt-1 ${marginColor}`}>{margin}%</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span>Bill: ₹{Number(d.bill_rate).toLocaleString('en-IN')}</span>
                <span>Pay: ₹{Number(d.pay_rate).toLocaleString('en-IN')}</span>
                <span className="text-gray-400 capitalize">/{d.bill_rate_unit?.replace('ly','')}</span>
              </div>
            </div>
          )}

          {/* Details */}
          <Section title="Deployment Details">
            <Grid2>
              <Detail label="Employee Code"    value={d.employees?.employee_code || '—'} />
              <Detail label="Designation"      value={d.employees?.designation || '—'} />
              <Detail label="Type"             value={DEPLOY_TYPES[d.deployment_type]?.label} />
              <Detail label="Contract"         value={d.client_contracts?.contract_number || '—'} />
              <Detail label="Work Order"       value={d.work_orders?.wo_number || '⚠️ None'} />
              <Detail label="Start Date"       value={d.start_date} />
              <Detail label="End Date"         value={d.end_date || 'Ongoing'} />
              {d.billing_status === 'bench' && (
                <Detail label="Bench Since"    value={d.bench_since} />
              )}
            </Grid2>
            {d.notes && <p className="mt-3 text-sm text-gray-500 italic">{d.notes}</p>}
          </Section>

          {/* Quick Status Change */}
          <Section title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              {d.billing_status !== 'active' && (
                <QuickBtn label="✅ Set Active"   onClick={() => onStatusChange(d.id, 'active')}   color="green" />
              )}
              {d.billing_status !== 'bench' && (
                <QuickBtn label="🪑 Move to Bench" onClick={() => onStatusChange(d.id, 'bench')}  color="yellow" />
              )}
              {d.billing_status !== 'on_hold' && (
                <QuickBtn label="⏸ Put On Hold"  onClick={() => onStatusChange(d.id, 'on_hold')} color="orange" />
              )}
              {d.billing_status !== 'closed' && (
                <QuickBtn label="🔒 Close"         onClick={() => onStatusChange(d.id, 'closed')} color="gray" />
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────
function QuickBtn({ label, onClick, color }) {
  const colors = {
    green:  'bg-green-50 border-green-300 text-green-800 hover:bg-green-100',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100',
    orange: 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100',
    gray:   'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100',
  }
  return (
    <button onClick={onClick}
      className={`border rounded-lg px-3 py-2 text-sm font-medium ${colors[color]}`}>
      {label}
    </button>
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
function fmtShort(n) {
  if (!n) return '0'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K'
  return Number(n).toFixed(0)
}
