import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Security','Housekeeping','Labour','Driver','Peon','Helper','Other']

const EMPTY_WORKER = {
  name: '', phone: '', aadhaar_last4: '', category: 'Security',
  skill: '', daily_wage: '', ot_rate: '',
  pf_applicable: false, esic_applicable: false, status: 'active',
}

// ─── Main Page ─────────────────────────────────────────────────
export default function FlexiStaffing() {
  const [tab, setTab]             = useState('workers')
  const [workers, setWorkers]     = useState([])
  const [clients, setClients]     = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected]   = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: w }, { data: cl }, { data: wo }] = await Promise.all([
      supabase.from('flexi_workers').select('*').order('name'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('work_orders').select('id, wo_number, client_id').eq('status', 'active'),
    ])
    setWorkers(w || [])
    setClients(cl || [])
    setWorkOrders(wo || [])
    setLoading(false)
  }

  const filtered = workers.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.worker_code?.toLowerCase().includes(search.toLowerCase()) ||
    w.category?.toLowerCase().includes(search.toLowerCase())
  )

  const summary = {
    total:  workers.length,
    active: workers.filter(w => w.status === 'active').length,
    pf:     workers.filter(w => w.pf_applicable).length,
    esic:   workers.filter(w => w.esic_applicable).length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Flexi Staffing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily wage workers — attendance & billing</p>
        </div>
        {tab === 'workers' && (
          <button onClick={() => { setSelected(null); setShowModal(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add Worker
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[['workers','👷 Workers'],['attendance','📅 Attendance'],['billing','💰 Billing']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {tab === 'workers' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <SC label="Total Workers" value={summary.total}  color="blue"   />
            <SC label="Active"        value={summary.active} color="green"  />
            <SC label="PF Enrolled"   value={summary.pf}     color="purple" />
            <SC label="ESIC Enrolled" value={summary.esic}   color="indigo" />
          </div>

          <input type="text" placeholder="Search worker, code, category..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400" />

          {loading ? <Loader /> : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Code','Name','Category','Daily Wage','OT Rate','PF','ESIC','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filtered.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-700">{w.worker_code || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                      <td className="px-4 py-3"><span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs">{w.category}</span></td>
                      <td className="px-4 py-3 text-gray-700">₹{w.daily_wage}/day</td>
                      <td className="px-4 py-3 text-gray-500">{w.ot_rate ? `₹${w.ot_rate}/hr` : '—'}</td>
                      <td className="px-4 py-3">{w.pf_applicable  ? <Tick /> : <Cross />}</td>
                      <td className="px-4 py-3">{w.esic_applicable ? <Tick /> : <Cross />}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelected(w); setShowModal(true) }}
                          className="text-blue-600 hover:underline text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'attendance' && (
        <AttendanceTab workers={workers} clients={clients} workOrders={workOrders} />
      )}

      {tab === 'billing' && (
        <BillingTab clients={clients} workOrders={workOrders} />
      )}

      {showModal && (
        <WorkerModal worker={selected} onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }} />
      )}
    </div>
  )
}

// ─── Attendance Tab ────────────────────────────────────────────
function AttendanceTab({ workers, clients, workOrders }) {
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState('')
  const [woId, setWoId]         = useState('')
  const [attendance, setAtt]    = useState({})   // workerId → { present, ot_hours }
  const [existing, setExisting] = useState([])
  const [saving, setSaving]     = useState(false)

  const clientWOs = workOrders.filter(w => w.client_id === clientId)
  const activeWorkers = workers.filter(w => w.status === 'active')

  useEffect(() => {
    if (date && clientId) fetchExisting()
  }, [date, clientId])

  async function fetchExisting() {
    const { data } = await supabase
      .from('flexi_attendance')
      .select('*')
      .eq('date', date)
      .eq('client_id', clientId)
    setExisting(data || [])
    // Pre-fill attendance state
    const map = {}
    activeWorkers.forEach(w => {
      const rec = (data || []).find(a => a.worker_id === w.id)
      map[w.id] = { present: rec?.present ?? true, ot_hours: rec?.ot_hours ?? 0, existingId: rec?.id }
    })
    setAtt(map)
  }

  function toggle(wid, key, val) {
    setAtt(a => ({ ...a, [wid]: { ...a[wid], [key]: val } }))
  }

  async function saveAttendance() {
    if (!clientId) { alert('Client select karo'); return }
    if (!date)     { alert('Date select karo'); return }
    setSaving(true)

    for (const w of activeWorkers) {
      const rec = attendance[w.id] || { present: true, ot_hours: 0 }
      const daily_wage  = rec.present ? (w.daily_wage || 0) : 0
      const ot_amount   = (rec.ot_hours || 0) * (w.ot_rate || 0)
      const total_amount = daily_wage + ot_amount

      const payload = {
        worker_id: w.id, client_id: clientId,
        work_order_id: woId || null, date,
        present: rec.present, ot_hours: rec.ot_hours || 0,
        daily_wage, ot_amount, total_amount, billed: false,
      }

      if (rec.existingId) {
        await supabase.from('flexi_attendance').update(payload).eq('id', rec.existingId)
      } else {
        await supabase.from('flexi_attendance').insert(payload)
      }
    }
    setSaving(false)
    alert('✅ Attendance saved!')
    fetchExisting()
  }

  const presentCount = Object.values(attendance).filter(a => a.present).length
  const totalWage    = activeWorkers.reduce((sum, w) => {
    const a = attendance[w.id]
    if (!a?.present) return sum
    return sum + (w.daily_wage || 0) + ((a.ot_hours || 0) * (w.ot_rate || 0))
  }, 0)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Client</label>
          <select value={clientId} onChange={e => { setClientId(e.target.value); setWoId('') }} className={inp}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Work Order</label>
          <select value={woId} onChange={e => setWoId(e.target.value)} className={inp} disabled={!clientId}>
            <option value="">No WO</option>
            {clientWOs.map(w => <option key={w.id} value={w.id}>{w.wo_number}</option>)}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {clientId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-6 text-sm">
          <span className="text-blue-700">Present: <strong>{presentCount}/{activeWorkers.length}</strong></span>
          <span className="text-blue-700">Total Wage: <strong>₹{Number(totalWage).toLocaleString('en-IN')}</strong></span>
        </div>
      )}

      {/* Bulk mark */}
      {clientId && (
        <div className="flex gap-2 mb-2">
          <button onClick={() => {
            const map = {}
            activeWorkers.forEach(w => map[w.id] = { ...(attendance[w.id] || {}), present: true })
            setAtt(map)
          }} className="text-xs border border-gray-300 rounded px-3 py-1 hover:bg-gray-50">Mark All Present</button>
          <button onClick={() => {
            const map = {}
            activeWorkers.forEach(w => map[w.id] = { ...(attendance[w.id] || {}), present: false })
            setAtt(map)
          }} className="text-xs border border-gray-300 rounded px-3 py-1 hover:bg-gray-50">Mark All Absent</button>
        </div>
      )}

      {/* Attendance Grid */}
      {clientId && activeWorkers.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worker</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Present</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">OT Hours</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {activeWorkers.map(w => {
                  const a = attendance[w.id] || { present: true, ot_hours: 0 }
                  const amt = a.present
                    ? (w.daily_wage || 0) + ((a.ot_hours || 0) * (w.ot_rate || 0))
                    : 0
                  return (
                    <tr key={w.id} className={`${!a.present ? 'bg-gray-50 opacity-60' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">{w.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{w.category}</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => toggle(w.id, 'present', !a.present)}
                          className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                            a.present ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                          {a.present ? 'P' : 'A'}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input type="number" min="0" max="12" step="0.5"
                          value={a.ot_hours || 0}
                          onChange={e => toggle(w.id, 'ot_hours', +e.target.value)}
                          disabled={!a.present}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40" />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800">
                        {a.present ? `₹${amt.toFixed(0)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button onClick={saveAttendance} disabled={saving}
              className={`bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {saving ? 'Saving...' : '💾 Save Attendance'}
            </button>
          </div>
        </>
      )}

      {!clientId && (
        <div className="text-center py-12 text-gray-400">Client select karo attendance mark karne ke liye</div>
      )}
    </div>
  )
}

// ─── Billing Tab ───────────────────────────────────────────────
function BillingTab({ clients, workOrders }) {
  const now = new Date()
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [year, setYear]       = useState(now.getFullYear())
  const [clientId, setClientId] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  async function fetchBilling() {
    if (!clientId) { alert('Client select karo'); return }
    setLoading(true)
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end   = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('flexi_attendance')
      .select('*, flexi_workers(name, category, daily_wage, ot_rate)')
      .eq('client_id', clientId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
    setRecords(data || [])
    setLoading(false)
  }

  // Group by worker
  const byWorker = records.reduce((acc, r) => {
    const id = r.worker_id
    if (!acc[id]) acc[id] = { worker: r.flexi_workers, days: 0, ot: 0, total: 0 }
    if (r.present) acc[id].days++
    acc[id].ot    += r.ot_hours || 0
    acc[id].total += r.total_amount || 0
    return acc
  }, {})

  const grandTotal = Object.values(byWorker).reduce((s, w) => s + w.total, 0)
  const unbilled   = records.filter(r => !r.billed).length

  async function markBilled() {
    const ids = records.filter(r => !r.billed).map(r => r.id)
    if (!ids.length) { alert('Sab already billed hai'); return }
    await supabase.from('flexi_attendance').update({ billed: true }).in('id', ids)
    fetchBilling()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Month</label>
          <select value={month} onChange={e => setMonth(+e.target.value)} className={inp}>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Year</label>
          <select value={year} onChange={e => setYear(+e.target.value)} className={inp}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={inp}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
        </div>
        <button onClick={fetchBilling}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Generate
        </button>
      </div>

      {loading && <Loader />}

      {Object.keys(byWorker).length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm text-gray-600">
              <span>Workers: <strong>{Object.keys(byWorker).length}</strong></span>
              <span>Unbilled records: <strong className={unbilled > 0 ? 'text-red-600' : 'text-green-600'}>{unbilled}</strong></span>
              <span>Total: <strong className="text-gray-900">₹{Number(grandTotal).toLocaleString('en-IN')}</strong></span>
            </div>
            {unbilled > 0 && (
              <button onClick={markBilled}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                ✅ Mark All Billed
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>{['Worker','Category','Days Present','OT Hours','Total Amount'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {Object.values(byWorker).map((w, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{w.worker?.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{w.worker?.category}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{w.days}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{w.ot.toFixed(1)}h</td>
                    <td className="px-4 py-3 font-bold text-green-700">₹{Number(w.total).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 font-bold text-gray-900">₹{Number(grandTotal).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Worker Modal ──────────────────────────────────────────────
function WorkerModal({ worker, onClose, onSaved }) {
  const isEdit = !!worker?.id
  const [form, setForm] = useState(isEdit ? { ...worker } : { ...EMPTY_WORKER })
  const [saving, setSaving] = useState(false)
  function setF(k,v) { setForm(f => ({...f, [k]: v})) }

  async function handleSave() {
    if (!form.name) { alert('Name required'); return }
    setSaving(true)
    const payload = { ...form, daily_wage: +form.daily_wage || 0, ot_rate: +form.ot_rate || 0 }
    delete payload.id
    if (isEdit) {
      await supabase.from('flexi_workers').update(payload).eq('id', worker.id)
    } else {
      // Auto-generate worker code
      const code = 'FW-' + Date.now().toString().slice(-6)
      await supabase.from('flexi_workers').insert({ ...payload, worker_code: code })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Worker' : 'New Worker'}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Name *"><input className={inp} value={form.name} onChange={e => setF('name',e.target.value)} /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Phone"><input className={inp} value={form.phone||''} onChange={e => setF('phone',e.target.value)} /></FR>
            <FR label="Aadhaar Last 4"><input className={inp} maxLength={4} value={form.aadhaar_last4||''} onChange={e => setF('aadhaar_last4',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Category">
              <select className={inp} value={form.category} onChange={e => setF('category',e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FR>
            <FR label="Skill"><input className={inp} value={form.skill||''} onChange={e => setF('skill',e.target.value)} placeholder="e.g. Supervisor" /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Daily Wage (₹)"><input type="number" className={inp} value={form.daily_wage||''} onChange={e => setF('daily_wage',e.target.value)} /></FR>
            <FR label="OT Rate (₹/hr)"><input type="number" className={inp} value={form.ot_rate||''} onChange={e => setF('ot_rate',e.target.value)} /></FR>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <Tog label="PF Applicable"   checked={form.pf_applicable}   onChange={v => setF('pf_applicable',v)} />
            <Tog label="ESIC Applicable" checked={form.esic_applicable} onChange={v => setF('esic_applicable',v)} />
          </div>
          <FR label="Status">
            <select className={inp} value={form.status} onChange={e => setF('status',e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </FR>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Worker'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
function FR({label,children}){ return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}</label>{children}</div> }
function SC({label,value,color}){
  const c={blue:'bg-blue-50 border-blue-200 text-blue-700',green:'bg-green-50 border-green-200 text-green-700',purple:'bg-purple-50 border-purple-200 text-purple-700',indigo:'bg-indigo-50 border-indigo-200 text-indigo-700'}
  return <div className={`border rounded-xl p-4 ${c[color]}`}><p className="text-2xl font-bold">{value}</p><p className="text-xs font-semibold mt-1 opacity-70 uppercase">{label}</p></div>
}
function Tog({label,checked,onChange}){
  return <label className="flex items-center justify-between cursor-pointer">
    <span className="text-sm text-gray-700">{label}</span>
    <div onClick={()=>onChange(!checked)} className={`w-11 h-6 rounded-full relative cursor-pointer ${checked?'bg-blue-600':'bg-gray-300'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked?'translate-x-6':'translate-x-1'}`}/>
    </div>
  </label>
}
function Tick(){ return <span className="text-green-500 font-bold">✓</span> }
function Cross(){ return <span className="text-gray-300">—</span> }
function Loader(){ return <div className="text-center py-12 text-gray-400">Loading...</div> }
