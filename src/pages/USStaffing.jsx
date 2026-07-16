import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VISA_TYPES = ['H1B','L1','OPT','CPT','GC','USC','TN','H4_EAD','Other']
const ENG_TYPES  = ['W2','C2C','1099']
const STAGES     = ['submitted','interview_scheduled','interview_done','selected','offer_extended','placed','rejected','withdrawn']

const EMPTY_CONSULTANT = {
  name:'', email:'', phone:'', engagement_type:'W2', visa_type:'H1B',
  visa_expiry:'', ead_expiry:'', pay_rate:'', pay_rate_type:'hourly',
  currency:'USD', status:'active', bench_since:'', location_state:'',
  benefits_enrolled:false, health_insurance:'', retirement_401k:'',
}

// ─── Main Page ─────────────────────────────────────────────────
export default function USStaffing() {
  const [tab, setTab]               = useState('consultants')
  const [consultants, setConsultants] = useState([])
  const [clients, setClients]       = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [submittals, setSubmittals] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [selected, setSelected]     = useState(null)
  const [search, setSearch]         = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: cl }, { data: wo }, { data: ts }, { data: sub }] = await Promise.all([
      supabase.from('us_consultants').select('*').order('name'),
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('work_orders').select('id,wo_number,client_id').eq('status','active'),
      supabase.from('us_timesheets').select('*, us_consultants(name), clients(client_name)').order('week_start', { ascending: false }).limit(100),
      supabase.from('us_submittals').select('*, us_consultants(name), clients(client_name)').order('submitted_date', { ascending: false }),
    ])
    setConsultants(c || [])
    setClients(cl || [])
    setWorkOrders(wo || [])
    setTimesheets(ts || [])
    setSubmittals(sub || [])
    setLoading(false)
  }

  // Visa alerts
  const visaAlerts = consultants.filter(c => {
    if (!c.visa_expiry && !c.ead_expiry) return false
    const d1 = c.visa_expiry ? Math.ceil((new Date(c.visa_expiry) - new Date()) / 86400000) : 999
    const d2 = c.ead_expiry  ? Math.ceil((new Date(c.ead_expiry)  - new Date()) / 86400000) : 999
    return Math.min(d1,d2) <= 90
  })

  const summary = {
    total:   consultants.length,
    active:  consultants.filter(c => c.status === 'active').length,
    bench:   consultants.filter(c => c.status === 'bench').length,
    placed:  consultants.filter(c => c.status === 'placed').length,
    visaAlert: visaAlerts.length,
    unbilledTS: timesheets.filter(t => t.status === 'approved' && !t.invoice_raised).length,
  }

  const filtered = consultants.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.visa_type?.toLowerCase().includes(search.toLowerCase()) ||
    c.engagement_type?.toLowerCase().includes(search.toLowerCase()) ||
    c.location_state?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">US Staffing</h1>
          <p className="text-sm text-gray-500 mt-0.5">W2 · C2C · 1099 — Visa · Timesheets · Submittals</p>
        </div>
        {tab === 'consultants' && (
          <button onClick={() => { setSelected(null); setShowModal(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add Consultant
          </button>
        )}
        {tab === 'timesheets' && (
          <button onClick={() => { setSelected({ _type:'timesheet' }); setShowModal(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add Timesheet
          </button>
        )}
        {tab === 'submittals' && (
          <button onClick={() => { setSelected({ _type:'submittal' }); setShowModal(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + New Submittal
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[['consultants','👤 Consultants'],['visa','🛂 Visa Tracker'],['timesheets','⏱️ Timesheets'],['submittals','📤 Submittals']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              tab===k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {l}
            {k==='visa' && summary.visaAlert > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{summary.visaAlert}</span>
            )}
            {k==='timesheets' && summary.unbilledTS > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{summary.unbilledTS}</span>
            )}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { label:'Total',        value: summary.total,       color:'blue'   },
          { label:'Active',       value: summary.active,      color:'green'  },
          { label:'On Bench',     value: summary.bench,       color:'yellow' },
          { label:'Placed',       value: summary.placed,      color:'indigo' },
          { label:'Visa Alerts',  value: summary.visaAlert,   color:'red'    },
          { label:'TS Unbilled',  value: summary.unbilledTS,  color:'orange' },
        ].map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <>
          {/* ── Consultants Tab ── */}
          {tab === 'consultants' && (
            <>
              <input type="text" placeholder="Search name, visa type, state..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400" />

              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Name','Type','Visa','Visa Expiry','Pay Rate','State','Status','Bench Since',''].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filtered.map(c => {
                      const visaDays = c.visa_expiry ? Math.ceil((new Date(c.visa_expiry)-new Date())/86400000) : null
                      const eadDays  = c.ead_expiry  ? Math.ceil((new Date(c.ead_expiry) -new Date())/86400000) : null
                      const alertDays = Math.min(visaDays??999, eadDays??999)
                      const isVisa = alertDays <= 30
                      const isWarn = alertDays <= 90 && alertDays > 30
                      const benchDays = c.bench_since ? Math.ceil((new Date()-new Date(c.bench_since))/86400000) : null

                      return (
                        <tr key={c.id} className={`hover:bg-gray-50 ${isVisa?'bg-red-50':''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              c.engagement_type==='W2'?'bg-blue-100 text-blue-800':
                              c.engagement_type==='C2C'?'bg-purple-100 text-purple-800':
                              'bg-gray-100 text-gray-700'}`}>
                              {c.engagement_type}
                            </span>
                          </td>
                          <td className="px-4 py-3"><span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">{c.visa_type}</span></td>
                          <td className="px-4 py-3">
                            {c.visa_expiry ? (
                              <div>
                                <p className={`text-sm ${isVisa?'text-red-600 font-bold':isWarn?'text-orange-500 font-medium':'text-gray-600'}`}>
                                  {c.visa_expiry} {isVisa?'🔴':isWarn?'🟡':''}
                                </p>
                                {c.ead_expiry && <p className="text-xs text-gray-400">EAD: {c.ead_expiry}</p>}
                              </div>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800">${c.pay_rate}/{c.pay_rate_type==='hourly'?'hr':c.pay_rate_type==='daily'?'day':'mo'}</td>
                          <td className="px-4 py-3 text-gray-600">{c.location_state||'—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              c.status==='active'?'bg-green-100 text-green-800':
                              c.status==='bench'?'bg-yellow-100 text-yellow-800':
                              c.status==='placed'?'bg-blue-100 text-blue-800':
                              'bg-gray-100 text-gray-600'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {benchDays!==null ? <span className="text-yellow-700 text-xs font-medium">{benchDays}d</span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setSelected(c); setShowModal(true) }}
                              className="text-blue-600 hover:underline text-xs">Edit</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filtered.length===0 && <div className="text-center py-12 text-gray-400">No consultants found</div>}
              </div>
            </>
          )}

          {/* ── Visa Tracker ── */}
          {tab === 'visa' && (
            <div className="space-y-3">
              {consultants.filter(c => c.status !== 'terminated').map(c => {
                const visaDays = c.visa_expiry ? Math.ceil((new Date(c.visa_expiry)-new Date())/86400000) : null
                const eadDays  = c.ead_expiry  ? Math.ceil((new Date(c.ead_expiry) -new Date())/86400000) : null
                const minDays  = Math.min(visaDays??999, eadDays??999)
                const severity = minDays <= 30 ? 'critical' : minDays <= 90 ? 'warning' : 'ok'
                const bg = severity==='critical'?'bg-red-50 border-red-200':severity==='warning'?'bg-yellow-50 border-yellow-200':'bg-white border-gray-200'

                return (
                  <div key={c.id} className={`border rounded-xl p-4 ${bg}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.engagement_type==='W2'?'bg-blue-100 text-blue-800':'bg-purple-100 text-purple-800'}`}>{c.engagement_type}</span>
                          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">{c.visa_type}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{c.location_state} · {c.status}</p>
                      </div>
                      <span className="text-2xl">{severity==='critical'?'🔴':severity==='warning'?'🟡':'✅'}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <VisaField label="Visa Expiry" value={c.visa_expiry} days={visaDays} />
                      <VisaField label="EAD Expiry"  value={c.ead_expiry}  days={eadDays}  />
                      <VisaField label="I-94 Expiry" value={c.i94_expiry}  />
                      <VisaField label="Passport"    value={c.passport_expiry} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Timesheets ── */}
          {tab === 'timesheets' && (
            <>
              {summary.unbilledTS > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex gap-2 text-sm text-orange-700">
                  <span>⚠️</span>
                  <span><strong>{summary.unbilledTS} approved timesheets</strong> not invoiced yet — raise invoices to prevent leakage.</span>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Consultant','Client','Week','Hrs','Bill Rate','Bill Amt','Pay Amt','Margin','Status','Invoice',''].map(h=>(
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {timesheets.map(t => {
                      const mp = t.margin_percent
                      return (
                        <tr key={t.id} className={`hover:bg-gray-50 ${t.status==='approved'&&!t.invoice_raised?'bg-orange-50':''}`}>
                          <td className="px-3 py-3 font-medium text-gray-900">{t.us_consultants?.name}</td>
                          <td className="px-3 py-3 text-gray-600">{t.clients?.client_name}</td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{t.week_start}</td>
                          <td className="px-3 py-3 font-semibold text-gray-800">{t.total_hrs}h</td>
                          <td className="px-3 py-3 text-gray-600">${t.bill_rate}/hr</td>
                          <td className="px-3 py-3 font-semibold text-green-700">${fmtUS(t.bill_amount)}</td>
                          <td className="px-3 py-3 text-gray-600">${fmtUS(t.pay_amount)}</td>
                          <td className="px-3 py-3">
                            <span className={`text-xs font-bold ${mp>=20?'text-green-700':mp>=10?'text-yellow-700':'text-red-600'}`}>
                              {mp?.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.status==='paid'?'bg-green-100 text-green-800':
                              t.status==='invoiced'?'bg-blue-100 text-blue-800':
                              t.status==='approved'?'bg-yellow-100 text-yellow-800':
                              'bg-gray-100 text-gray-600'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {t.status==='approved' && !t.invoice_raised
                              ? <button onClick={() => markTSInvoiced(t.id, fetchAll)}
                                  className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded font-medium">
                                  Raise Invoice
                                </button>
                              : t.invoice_raised ? <span className="text-xs text-green-600">✅ Invoiced</span> : null
                            }
                          </td>
                          <td className="px-3 py-3">
                            <TSStatusBtn ts={t} onUpdate={fetchAll} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {timesheets.length===0 && <div className="text-center py-12 text-gray-400">No timesheets yet</div>}
              </div>
            </>
          )}

          {/* ── Submittals ── */}
          {tab === 'submittals' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Consultant','Position','End Client','Submitted','Bill Rate','Pay Rate','Margin','Stage',''].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {submittals.map(s => {
                    const margin = s.bill_rate && s.pay_rate
                      ? (((s.bill_rate-s.pay_rate)/s.bill_rate)*100).toFixed(1) : null
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.us_consultants?.name}</td>
                        <td className="px-4 py-3 text-gray-700">{s.position}</td>
                        <td className="px-4 py-3 text-gray-600">{s.end_client || s.clients?.client_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{s.submitted_date}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{s.bill_rate?`$${s.bill_rate}/hr`:'—'}</td>
                        <td className="px-4 py-3 text-gray-600">{s.pay_rate?`$${s.pay_rate}/hr`:'—'}</td>
                        <td className="px-4 py-3">
                          {margin ? <span className={`text-xs font-bold ${+margin>=20?'text-green-700':+margin>=10?'text-yellow-700':'text-red-600'}`}>{margin}%</span> : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StageBadge stage={s.stage} />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setSelected({ _type:'submittal', ...s }); setShowModal(true) }}
                            className="text-blue-600 hover:underline text-xs">Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {submittals.length===0 && <div className="text-center py-12 text-gray-400">No submittals yet</div>}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showModal && selected?._type === 'timesheet' && (
        <TimesheetModal consultants={consultants} clients={clients} workOrders={workOrders}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }} />
      )}
      {showModal && selected?._type === 'submittal' && (
        <SubmittalModal submittal={selected?.id ? selected : null} consultants={consultants} clients={clients}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }} />
      )}
      {showModal && !selected?._type && (
        <ConsultantModal consultant={selected}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={() => { setShowModal(false); setSelected(null); fetchAll() }} />
      )}
    </div>
  )
}

// ─── Consultant Modal ──────────────────────────────────────────
function ConsultantModal({ consultant, onClose, onSaved }) {
  const isEdit = !!consultant?.id
  const [form, setForm] = useState(isEdit ? { ...consultant } : { ...EMPTY_CONSULTANT })
  const [saving, setSaving] = useState(false)
  function setF(k,v){setForm(f=>({...f,[k]:v}))}

  async function handleSave() {
    if (!form.name) { alert('Name required'); return }
    setSaving(true)
    const payload = { ...form, pay_rate:+form.pay_rate||0,
      health_insurance:+form.health_insurance||0, retirement_401k:+form.retirement_401k||0,
      bench_since: form.status==='bench' ? (form.bench_since||new Date().toISOString().split('T')[0]) : null }
    const code = isEdit ? form.consultant_code : 'USC-'+Date.now().toString().slice(-6)
    delete payload.id
    if (isEdit) await supabase.from('us_consultants').update(payload).eq('id',consultant.id)
    else await supabase.from('us_consultants').insert({ ...payload, consultant_code: code })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">{isEdit?'Edit Consultant':'New Consultant'}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Full Name *"><input className={inp} value={form.name} onChange={e=>setF('name',e.target.value)} /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Email"><input className={inp} value={form.email||''} onChange={e=>setF('email',e.target.value)} /></FR>
            <FR label="Phone"><input className={inp} value={form.phone||''} onChange={e=>setF('phone',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Engagement Type">
              <select className={inp} value={form.engagement_type} onChange={e=>setF('engagement_type',e.target.value)}>
                {ENG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </FR>
            <FR label="Visa Type">
              <select className={inp} value={form.visa_type||''} onChange={e=>setF('visa_type',e.target.value)}>
                <option value="">Select...</option>
                {VISA_TYPES.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Visa Expiry"><input type="date" className={inp} value={form.visa_expiry||''} onChange={e=>setF('visa_expiry',e.target.value)} /></FR>
            <FR label="EAD Expiry"><input type="date" className={inp} value={form.ead_expiry||''} onChange={e=>setF('ead_expiry',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="I-94 Expiry"><input type="date" className={inp} value={form.i94_expiry||''} onChange={e=>setF('i94_expiry',e.target.value)} /></FR>
            <FR label="Passport Expiry"><input type="date" className={inp} value={form.passport_expiry||''} onChange={e=>setF('passport_expiry',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FR label="Pay Rate ($)"><input type="number" className={inp} value={form.pay_rate||''} onChange={e=>setF('pay_rate',e.target.value)} /></FR>
            <FR label="Rate Type">
              <select className={inp} value={form.pay_rate_type} onChange={e=>setF('pay_rate_type',e.target.value)}>
                <option value="hourly">Per Hour</option>
                <option value="daily">Per Day</option>
                <option value="weekly">Per Week</option>
                <option value="monthly">Per Month</option>
              </select>
            </FR>
            <FR label="State (US)"><input className={inp} value={form.location_state||''} onChange={e=>setF('location_state',e.target.value)} placeholder="e.g. TX" /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Status">
              <select className={inp} value={form.status} onChange={e=>setF('status',e.target.value)}>
                <option value="active">Active</option>
                <option value="bench">Bench</option>
                <option value="placed">Placed</option>
                <option value="terminated">Terminated</option>
              </select>
            </FR>
            {form.status==='bench' && (
              <FR label="Bench Since"><input type="date" className={inp} value={form.bench_since||''} onChange={e=>setF('bench_since',e.target.value)} /></FR>
            )}
          </div>
          {form.engagement_type==='W2' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase">W2 Benefits</p>
              <Tog label="Benefits Enrolled" checked={form.benefits_enrolled} onChange={v=>setF('benefits_enrolled',v)} />
              <div className="grid grid-cols-2 gap-3">
                <FR label="Health Insurance ($/mo)"><input type="number" className={inp} value={form.health_insurance||''} onChange={e=>setF('health_insurance',e.target.value)} /></FR>
                <FR label="401k Match (%)"><input type="number" className={inp} value={form.retirement_401k||''} onChange={e=>setF('retirement_401k',e.target.value)} /></FR>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving?'Saving...':isEdit?'Update':'Add Consultant'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timesheet Modal ───────────────────────────────────────────
function TimesheetModal({ consultants, clients, workOrders, onClose, onSaved }) {
  const [consultantId, setConsultantId] = useState('')
  const [clientId, setClientId]         = useState('')
  const [woId, setWoId]                 = useState('')
  const [weekStart, setWeekStart]       = useState('')
  const [hrs, setHrs] = useState({ mon:0,tue:0,wed:0,thu:0,fri:0,sat:0,sun:0 })
  const [billRate, setBillRate] = useState('')
  const [payRate, setPayRate]   = useState('')
  const [saving, setSaving]     = useState(false)

  const totalHrs   = Object.values(hrs).reduce((s,h)=>s+(+h||0),0)
  const billAmount = totalHrs * (+billRate||0)
  const payAmount  = totalHrs * (+payRate||0)
  const margin     = billAmount > 0 ? (((billAmount-payAmount)/billAmount)*100).toFixed(1) : 0
  const clientWOs  = workOrders.filter(w=>w.client_id===clientId)

  // Auto-fill pay rate from consultant
  useEffect(() => {
    const c = consultants.find(c=>c.id===consultantId)
    if (c && c.pay_rate_type==='hourly') setPayRate(String(c.pay_rate||''))
  },[consultantId])

  async function handleSave() {
    if (!consultantId||!clientId||!weekStart||!billRate) { alert('Fill all required fields'); return }
    const start = new Date(weekStart)
    const end   = new Date(start); end.setDate(end.getDate()+6)
    setSaving(true)
    await supabase.from('us_timesheets').insert({
      consultant_id: consultantId, client_id: clientId,
      work_order_id: woId||null,
      week_start: weekStart, week_end: end.toISOString().split('T')[0],
      ...Object.fromEntries(Object.entries(hrs).map(([k,v])=>[k+'_hrs',+v||0])),
      bill_rate:+billRate, pay_rate:+payRate||null,
      bill_amount: billAmount, pay_amount: payAmount,
      margin_amount: billAmount-payAmount,
      margin_percent:+margin, status:'pending',
    })
    setSaving(false)
    onSaved()
  }

  const DAYS = ['mon','tue','wed','thu','fri','sat','sun']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">New Timesheet</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Consultant *">
            <select value={consultantId} onChange={e=>setConsultantId(e.target.value)} className={inp}>
              <option value="">Select...</option>
              {consultants.map(c=><option key={c.id} value={c.id}>{c.name} ({c.engagement_type})</option>)}
            </select>
          </FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Client *">
              <select value={clientId} onChange={e=>{setClientId(e.target.value);setWoId('')}} className={inp}>
                <option value="">Select...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select>
            </FR>
            <FR label="Work Order">
              <select value={woId} onChange={e=>setWoId(e.target.value)} className={inp} disabled={!clientId}>
                <option value="">No WO</option>
                {clientWOs.map(w=><option key={w.id} value={w.id}>{w.wo_number}</option>)}
              </select>
            </FR>
          </div>
          <FR label="Week Start (Monday) *">
            <input type="date" className={inp} value={weekStart} onChange={e=>setWeekStart(e.target.value)} />
          </FR>

          {/* Daily Hours Grid */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Daily Hours</p>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(d=>(
                <div key={d} className="text-center">
                  <p className="text-xs text-gray-400 uppercase mb-1">{d}</p>
                  <input type="number" min="0" max="24" step="0.5"
                    value={hrs[d]} onChange={e=>setHrs(h=>({...h,[d]:e.target.value}))}
                    className="w-full border border-gray-300 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-gray-700 mt-2">Total: <span className="text-blue-600">{totalHrs}h</span></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FR label="Bill Rate ($/hr) *"><input type="number" className={inp} value={billRate} onChange={e=>setBillRate(e.target.value)} /></FR>
            <FR label="Pay Rate ($/hr)"><input type="number" className={inp} value={payRate} onChange={e=>setPayRate(e.target.value)} /></FR>
          </div>

          {billRate && (
            <div className={`rounded-xl p-3 border text-sm ${+margin>=20?'bg-green-50 border-green-200 text-green-800':+margin>=10?'bg-yellow-50 border-yellow-200 text-yellow-800':'bg-red-50 border-red-200 text-red-800'}`}>
              Bill: <strong>${fmtUS(billAmount)}</strong> | Pay: <strong>${fmtUS(payAmount)}</strong> | Margin: <strong>{margin}%</strong>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving?'Saving...':'Save Timesheet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Submittal Modal ───────────────────────────────────────────
function SubmittalModal({ submittal, consultants, clients, onClose, onSaved }) {
  const isEdit = !!submittal?.id
  const [form, setForm] = useState(isEdit ? { ...submittal } : {
    position:'', end_client:'', prime_vendor:'', submitted_date:new Date().toISOString().split('T')[0],
    bill_rate:'', pay_rate:'', stage:'submitted', notes:'',
  })
  const [consultantId, setConsultantId] = useState(submittal?.consultant_id||'')
  const [clientId, setClientId]         = useState(submittal?.client_id||'')
  const [saving, setSaving] = useState(false)
  function setF(k,v){setForm(f=>({...f,[k]:v}))}

  const margin = form.bill_rate && form.pay_rate
    ? (((form.bill_rate-form.pay_rate)/form.bill_rate)*100).toFixed(1) : null

  async function handleSave() {
    if (!consultantId||!form.position) { alert('Consultant and Position required'); return }
    setSaving(true)
    const payload = { ...form, consultant_id:consultantId, client_id:clientId||null,
      bill_rate:+form.bill_rate||null, pay_rate:+form.pay_rate||null }
    delete payload.us_consultants; delete payload.clients; delete payload.id
    if (isEdit) await supabase.from('us_submittals').update(payload).eq('id',submittal.id)
    else await supabase.from('us_submittals').insert(payload)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">{isEdit?'Edit Submittal':'New Submittal'}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Consultant *">
            <select value={consultantId} onChange={e=>setConsultantId(e.target.value)} className={inp}>
              <option value="">Select...</option>
              {consultants.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FR>
          <FR label="Position *"><input className={inp} value={form.position} onChange={e=>setF('position',e.target.value)} placeholder="e.g. Java Developer" /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="End Client"><input className={inp} value={form.end_client||''} onChange={e=>setF('end_client',e.target.value)} /></FR>
            <FR label="Prime Vendor"><input className={inp} value={form.prime_vendor||''} onChange={e=>setF('prime_vendor',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Submitted Date"><input type="date" className={inp} value={form.submitted_date} onChange={e=>setF('submitted_date',e.target.value)} /></FR>
            <FR label="Stage">
              <select className={inp} value={form.stage} onChange={e=>setF('stage',e.target.value)}>
                {STAGES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Bill Rate ($/hr)"><input type="number" className={inp} value={form.bill_rate||''} onChange={e=>setF('bill_rate',e.target.value)} /></FR>
            <FR label="Pay Rate ($/hr)"><input type="number" className={inp} value={form.pay_rate||''} onChange={e=>setF('pay_rate',e.target.value)} /></FR>
          </div>
          {margin && (
            <p className={`text-sm font-semibold ${+margin>=20?'text-green-700':+margin>=10?'text-yellow-700':'text-red-600'}`}>
              Margin: {margin}%
            </p>
          )}
          {form.stage==='interview_scheduled' && (
            <FR label="Interview Date"><input type="datetime-local" className={inp} value={form.interview_date||''} onChange={e=>setF('interview_date',e.target.value)} /></FR>
          )}
          <FR label="Notes"><textarea className={inp} rows={2} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} /></FR>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving?'Saving...':isEdit?'Update':'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
function FR({label,children}){return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}</label>{children}</div>}
function KpiCard({label,value,color}){
  const c={blue:'bg-blue-50 border-blue-200 text-blue-700',green:'bg-green-50 border-green-200 text-green-700',yellow:'bg-yellow-50 border-yellow-200 text-yellow-700',red:'bg-red-50 border-red-200 text-red-700',indigo:'bg-indigo-50 border-indigo-200 text-indigo-700',orange:'bg-orange-50 border-orange-200 text-orange-700'}
  return <div className={`border rounded-xl p-3 ${c[color]||c.blue}`}><p className="text-xl font-bold">{value}</p><p className="text-xs font-semibold mt-0.5 opacity-70 uppercase">{label}</p></div>
}
function VisaField({label,value,days}){
  if (!value) return <div><p className="text-xs text-gray-400">{label}</p><p className="text-sm text-gray-300">—</p></div>
  const color = days!=null ? (days<=30?'text-red-600 font-bold':days<=90?'text-orange-500 font-medium':'text-gray-700') : 'text-gray-700'
  return <div><p className="text-xs text-gray-400">{label}</p><p className={`text-sm ${color}`}>{value}{days!=null?` (${days}d)`:''}</p></div>
}
function StageBadge({stage}){
  const c={placed:'bg-green-100 text-green-800',rejected:'bg-red-100 text-red-800',withdrawn:'bg-gray-100 text-gray-600',submitted:'bg-blue-100 text-blue-800',interview_scheduled:'bg-purple-100 text-purple-800',offer_extended:'bg-yellow-100 text-yellow-800'}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${c[stage]||'bg-gray-100 text-gray-700'}`}>{stage?.replace(/_/g,' ')}</span>
}
function Tog({label,checked,onChange}){
  return <label className="flex items-center justify-between cursor-pointer">
    <span className="text-sm text-gray-700">{label}</span>
    <div onClick={()=>onChange(!checked)} className={`w-11 h-6 rounded-full relative cursor-pointer ${checked?'bg-blue-600':'bg-gray-300'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked?'translate-x-6':'translate-x-1'}`}/>
    </div>
  </label>
}
function TSStatusBtn({ts,onUpdate}){
  const next = ts.status==='pending'?'approved':ts.status==='approved'?'invoiced':ts.status==='invoiced'?'paid':null
  if (!next) return null
  return <button onClick={async()=>{await supabase.from('us_timesheets').update({status:next}).eq('id',ts.id);onUpdate()}}
    className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-600 hover:bg-gray-50">→ {next}</button>
}
async function markTSInvoiced(id, refresh){
  await supabase.from('us_timesheets').update({invoice_raised:true,status:'invoiced'}).eq('id',id)
  refresh()
}
function fmtUS(n){ if(!n) return '0'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:0}) }
