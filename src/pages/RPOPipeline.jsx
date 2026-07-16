import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = [
  { key: 'applied',          label: 'Applied',        color: 'bg-gray-100',   text: 'text-gray-700'   },
  { key: 'screening',        label: 'Screening',      color: 'bg-blue-100',   text: 'text-blue-700'   },
  { key: 'interview_l1',     label: 'Interview L1',   color: 'bg-indigo-100', text: 'text-indigo-700' },
  { key: 'interview_l2',     label: 'Interview L2',   color: 'bg-purple-100', text: 'text-purple-700' },
  { key: 'interview_l3',     label: 'Interview L3',   color: 'bg-violet-100', text: 'text-violet-700' },
  { key: 'offered',          label: 'Offered',        color: 'bg-yellow-100', text: 'text-yellow-700' },
  { key: 'offer_accepted',   label: 'Offer Accepted', color: 'bg-orange-100', text: 'text-orange-700' },
  { key: 'joined',           label: 'Joined ✅',      color: 'bg-green-100',  text: 'text-green-700'  },
  { key: 'offer_declined',   label: 'Declined',       color: 'bg-red-100',    text: 'text-red-700'    },
  { key: 'rejected',         label: 'Rejected',       color: 'bg-red-100',    text: 'text-red-700'    },
]

const ACTIVE_STAGES = STAGES.slice(0, 7) // for kanban

// ─── Main Page ─────────────────────────────────────────────────
export default function RPOPipeline() {
  const [tab, setTab]           = useState('pipeline')
  const [requisitions, setReqs] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [clients, setClients]   = useState([])
  const [candidates, setCands]  = useState([])
  const [loading, setLoading]   = useState(true)
  const [selectedReq, setSelectedReq] = useState(null)
  const [showReqModal, setShowReqModal] = useState(false)
  const [showCandModal, setShowCandModal] = useState(false)
  const [selectedCand, setSelectedCand]   = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: cl }, { data: ca }] = await Promise.all([
      supabase.from('job_requisitions').select('*, clients(client_name)').order('created_at', { ascending: false }),
      supabase.from('candidate_pipeline').select('*, candidates(name,email,phone,current_company,experience_yrs,expected_ctc), job_requisitions(title,clients(client_name))').order('updated_at', { ascending: false }),
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('candidates').select('*').order('name'),
    ])
    setReqs(r || [])
    setPipeline(p || [])
    setClients(cl || [])
    setCands(ca || [])
    setLoading(false)
  }

  const pipelineForReq = selectedReq
    ? pipeline.filter(p => p.requisition_id === selectedReq.id)
    : pipeline

  // Funnel metrics
  const metrics = {
    total:    pipeline.length,
    active:   pipeline.filter(p => !['joined','offer_declined','rejected','dropped'].includes(p.stage)).length,
    offers:   pipeline.filter(p => ['offered','offer_accepted'].includes(p.stage)).length,
    joined:   pipeline.filter(p => p.stage === 'joined').length,
    uninvoiced: pipeline.filter(p => p.stage === 'joined' && !p.invoice_raised).length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">RPO Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Job requisitions · Candidate pipeline · Placement tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowCandModal(true); setSelectedCand(null) }}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            + Add Candidate
          </button>
          <button onClick={() => { setShowReqModal(true); setSelectedReq(null) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + New Requisition
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[['pipeline','🎯 Pipeline'],['requisitions','📋 Requisitions'],['candidates','👤 Candidates']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label:'In Pipeline', value: metrics.active,     color:'blue'   },
          { label:'Total',       value: metrics.total,      color:'gray'   },
          { label:'Offers Out',  value: metrics.offers,     color:'yellow' },
          { label:'Joined',      value: metrics.joined,     color:'green'  },
          { label:'Uninvoiced 🔴', value: metrics.uninvoiced, color:'red'  },
        ].map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Uninvoiced alert */}
      {metrics.uninvoiced > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex gap-2 text-sm text-red-700">
          <span>🔴</span>
          <span><strong>{metrics.uninvoiced} candidate{metrics.uninvoiced > 1 ? 's' : ''}</strong> joined but placement invoice not raised — revenue leakage!</span>
        </div>
      )}

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <>
          {/* ── Pipeline Kanban ── */}
          {tab === 'pipeline' && (
            <div className="space-y-4">
              {/* Req filter */}
              <div className="flex gap-3 items-center">
                <select value={selectedReq?.id || ''} onChange={e => setSelectedReq(requisitions.find(r => r.id === e.target.value) || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">All Requisitions</option>
                  {requisitions.map(r => <option key={r.id} value={r.id}>{r.title} — {r.clients?.client_name}</option>)}
                </select>
                {selectedReq && <button onClick={() => setSelectedReq(null)} className="text-sm text-blue-600 hover:underline">Clear filter</button>}
              </div>

              {/* Kanban */}
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-3 min-w-max">
                  {ACTIVE_STAGES.map(stage => {
                    const cards = pipelineForReq.filter(p => p.stage === stage.key)
                    return (
                      <div key={stage.key} className="w-56 flex-shrink-0">
                        <div className={`${stage.color} rounded-t-lg px-3 py-2 flex items-center justify-between`}>
                          <span className={`text-xs font-semibold ${stage.text}`}>{stage.label}</span>
                          <span className={`text-xs font-bold ${stage.text}`}>{cards.length}</span>
                        </div>
                        <div className="bg-gray-50 rounded-b-lg min-h-[200px] p-2 space-y-2 border border-t-0 border-gray-200">
                          {cards.map(c => (
                            <CandCard key={c.id} card={c} stages={STAGES}
                              onMove={async (newStage) => {
                                const update = { stage: newStage, updated_at: new Date().toISOString() }
                                if (newStage === 'joined') update.joining_date = new Date().toISOString().split('T')[0]
                                await supabase.from('candidate_pipeline').update(update).eq('id', c.id)
                                fetchAll()
                              }}
                              onInvoice={async () => {
                                await supabase.from('candidate_pipeline').update({ invoice_raised: true }).eq('id', c.id)
                                fetchAll()
                              }}
                            />
                          ))}
                          {cards.length === 0 && (
                            <p className="text-xs text-gray-400 text-center pt-6">Empty</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Requisitions ── */}
          {tab === 'requisitions' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>{['Req No','Client','Position','Positions','Filled','Fee','Priority','Status',''].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {requisitions.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-700">{r.requisition_no || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.clients?.client_name}</td>
                      <td className="px-4 py-3 text-gray-700">{r.title}</td>
                      <td className="px-4 py-3 text-center">{r.positions}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={r.filled_count >= r.positions ? 'text-green-600 font-bold' : 'text-gray-700'}>
                          {r.filled_count}/{r.positions}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.fee_percent ? `${r.fee_percent}%` : r.retainer_amount ? `₹${Number(r.retainer_amount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge p={r.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status==='open'?'bg-green-100 text-green-800':'bg-gray-100 text-gray-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelectedReq(r); setShowReqModal(true) }}
                          className="text-blue-600 hover:underline text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {requisitions.length === 0 && <div className="text-center py-12 text-gray-400">No requisitions yet</div>}
            </div>
          )}

          {/* ── Candidates ── */}
          {tab === 'candidates' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>{['Name','Phone','Current Company','Exp','Expected CTC','Source',''].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {candidates.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-600">{c.current_company || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.experience_yrs ? `${c.experience_yrs}y` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.expected_ctc ? `₹${Number(c.expected_ctc/100000).toFixed(1)}L` : '—'}</td>
                      <td className="px-4 py-3"><span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">{c.source || '—'}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelectedCand(c); setShowCandModal(true) }}
                          className="text-blue-600 hover:underline text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {candidates.length === 0 && <div className="text-center py-12 text-gray-400">No candidates yet</div>}
            </div>
          )}
        </>
      )}

      {showReqModal && (
        <RequisitionModal req={selectedReq} clients={clients}
          onClose={() => { setShowReqModal(false); setSelectedReq(null) }}
          onSaved={() => { setShowReqModal(false); setSelectedReq(null); fetchAll() }} />
      )}

      {showCandModal && (
        <CandidateModal candidate={selectedCand} requisitions={requisitions}
          onClose={() => { setShowCandModal(false); setSelectedCand(null) }}
          onSaved={() => { setShowCandModal(false); setSelectedCand(null); fetchAll() }} />
      )}
    </div>
  )
}

// ─── Kanban Card ───────────────────────────────────────────────
function CandCard({ card: c, stages, onMove, onInvoice }) {
  const [open, setOpen] = useState(false)
  const cand = c.candidates
  const nextStages = stages.filter(s =>
    !['applied','offer_declined','rejected','dropped'].includes(s.key) && s.key !== c.stage
  )

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <p className="font-medium text-gray-900 text-sm">{cand?.name}</p>
      <p className="text-xs text-gray-500 mt-0.5">{cand?.current_company || 'No company'}</p>
      {cand?.experience_yrs && <p className="text-xs text-gray-400">{cand.experience_yrs}y exp</p>}
      {cand?.expected_ctc && (
        <p className="text-xs text-blue-600 font-medium mt-1">
          ₹{(cand.expected_ctc/100000).toFixed(1)}L
        </p>
      )}

      {/* Invoice badge */}
      {c.stage === 'joined' && !c.invoice_raised && (
        <button onClick={onInvoice}
          className="mt-2 w-full text-xs bg-red-100 text-red-700 rounded px-2 py-1 font-medium hover:bg-red-200">
          🔴 Raise Invoice
        </button>
      )}
      {c.stage === 'joined' && c.invoice_raised && (
        <span className="mt-1 block text-xs text-green-600">✅ Invoice raised</span>
      )}

      {/* Move stage */}
      <div className="mt-2 relative">
        <button onClick={() => setOpen(!open)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 hover:bg-gray-50">
          Move stage ▾
        </button>
        {open && (
          <div className="absolute top-7 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {nextStages.map(s => (
              <button key={s.key} onClick={() => { onMove(s.key); setOpen(false) }}
                className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                → {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Requisition Modal ─────────────────────────────────────────
function RequisitionModal({ req, clients, onClose, onSaved }) {
  const isEdit = !!req?.id
  const [form, setForm] = useState(isEdit ? { ...req } : {
    title:'', department:'', location:'', positions:1, experience_min:'',
    experience_max:'', salary_min:'', salary_max:'', billing_type:'per_hire',
    fee_percent:'', retainer_amount:'', guarantee_days:90, priority:'medium',
    status:'open', assigned_to:'',
  })
  const [clientId, setClientId] = useState(req?.client_id || '')
  const [saving, setSaving] = useState(false)
  function setF(k,v){setForm(f=>({...f,[k]:v}))}

  async function handleSave() {
    if (!clientId || !form.title) { alert('Client and Title required'); return }
    setSaving(true)
    const reqNo = isEdit ? form.requisition_no : 'REQ-' + Date.now().toString().slice(-6)
    const payload = { ...form, client_id: clientId, requisition_no: reqNo }
    delete payload.clients; delete payload.id
    if (isEdit) await supabase.from('job_requisitions').update(payload).eq('id', req.id)
    else await supabase.from('job_requisitions').insert(payload)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Requisition' : 'New Requisition'}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Client *">
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inp}>
              <option value="">Select...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </FR>
          <FR label="Job Title *"><input className={inp} value={form.title} onChange={e=>setF('title',e.target.value)} /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Department"><input className={inp} value={form.department||''} onChange={e=>setF('department',e.target.value)} /></FR>
            <FR label="Location"><input className={inp} value={form.location||''} onChange={e=>setF('location',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FR label="Positions"><input type="number" className={inp} value={form.positions} onChange={e=>setF('positions',+e.target.value)} /></FR>
            <FR label="Exp Min (yrs)"><input type="number" className={inp} value={form.experience_min||''} onChange={e=>setF('experience_min',e.target.value)} /></FR>
            <FR label="Exp Max (yrs)"><input type="number" className={inp} value={form.experience_max||''} onChange={e=>setF('experience_max',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Billing Type">
              <select className={inp} value={form.billing_type} onChange={e=>setF('billing_type',e.target.value)}>
                <option value="per_hire">Per Hire (% of CTC)</option>
                <option value="retainer">Retainer</option>
                <option value="retainer_per_hire">Retainer + Per Hire</option>
              </select>
            </FR>
            {form.billing_type !== 'retainer' && (
              <FR label="Fee %"><input type="number" className={inp} value={form.fee_percent||''} onChange={e=>setF('fee_percent',e.target.value)} placeholder="e.g. 8.33" /></FR>
            )}
            {form.billing_type !== 'per_hire' && (
              <FR label="Retainer (₹)"><input type="number" className={inp} value={form.retainer_amount||''} onChange={e=>setF('retainer_amount',e.target.value)} /></FR>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FR label="Guarantee (days)"><input type="number" className={inp} value={form.guarantee_days} onChange={e=>setF('guarantee_days',+e.target.value)} /></FR>
            <FR label="Priority">
              <select className={inp} value={form.priority} onChange={e=>setF('priority',e.target.value)}>
                {['low','medium','high','urgent'].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </FR>
            <FR label="Target Date"><input type="date" className={inp} value={form.target_date||''} onChange={e=>setF('target_date',e.target.value)} /></FR>
          </div>
          <FR label="Assigned Recruiter"><input className={inp} value={form.assigned_to||''} onChange={e=>setF('assigned_to',e.target.value)} placeholder="Recruiter name" /></FR>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving?'Saving...':isEdit?'Update':'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Candidate Modal ───────────────────────────────────────────
function CandidateModal({ candidate, requisitions, onClose, onSaved }) {
  const isEdit = !!candidate?.id
  const [form, setForm] = useState(isEdit ? { ...candidate } : {
    name:'', email:'', phone:'', current_company:'', current_ctc:'',
    expected_ctc:'', notice_period:'', experience_yrs:'', location:'', source:'Naukri',
  })
  const [reqId, setReqId]     = useState('')
  const [saving, setSaving]   = useState(false)
  function setF(k,v){setForm(f=>({...f,[k]:v}))}

  async function handleSave() {
    if (!form.name) { alert('Name required'); return }
    setSaving(true)
    const payload = { ...form, current_ctc: +form.current_ctc||null, expected_ctc: +form.expected_ctc||null,
      notice_period: +form.notice_period||null, experience_yrs: +form.experience_yrs||null }
    delete payload.id
    let candId = candidate?.id
    if (isEdit) {
      await supabase.from('candidates').update(payload).eq('id', candId)
    } else {
      const { data } = await supabase.from('candidates').insert(payload).select().single()
      candId = data?.id
    }
    // Add to pipeline if req selected
    if (reqId && candId && !isEdit) {
      await supabase.from('candidate_pipeline').insert({ candidate_id: candId, requisition_id: reqId, stage: 'applied' })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Candidate' : 'Add Candidate'}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <FR label="Name *"><input className={inp} value={form.name} onChange={e=>setF('name',e.target.value)} /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Email"><input className={inp} value={form.email||''} onChange={e=>setF('email',e.target.value)} /></FR>
            <FR label="Phone"><input className={inp} value={form.phone||''} onChange={e=>setF('phone',e.target.value)} /></FR>
          </div>
          <FR label="Current Company"><input className={inp} value={form.current_company||''} onChange={e=>setF('current_company',e.target.value)} /></FR>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Current CTC (₹)"><input type="number" className={inp} value={form.current_ctc||''} onChange={e=>setF('current_ctc',e.target.value)} /></FR>
            <FR label="Expected CTC (₹)"><input type="number" className={inp} value={form.expected_ctc||''} onChange={e=>setF('expected_ctc',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Experience (yrs)"><input type="number" step="0.5" className={inp} value={form.experience_yrs||''} onChange={e=>setF('experience_yrs',e.target.value)} /></FR>
            <FR label="Notice Period (days)"><input type="number" className={inp} value={form.notice_period||''} onChange={e=>setF('notice_period',e.target.value)} /></FR>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FR label="Location"><input className={inp} value={form.location||''} onChange={e=>setF('location',e.target.value)} /></FR>
            <FR label="Source">
              <select className={inp} value={form.source||'Naukri'} onChange={e=>setF('source',e.target.value)}>
                {['Naukri','LinkedIn','Referral','Direct','Indeed','Headhunt','Other'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </FR>
          </div>
          {!isEdit && (
            <FR label="Add to Requisition">
              <select value={reqId} onChange={e=>setReqId(e.target.value)} className={inp}>
                <option value="">Skip / Add later</option>
                {requisitions.filter(r=>r.status==='open').map(r=>(
                  <option key={r.id} value={r.id}>{r.title} — {r.clients?.client_name}</option>
                ))}
              </select>
            </FR>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ${saving?'opacity-50':''}`}>
            {saving?'Saving...':isEdit?'Update':'Add Candidate'}
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
  const c={blue:'bg-blue-50 border-blue-200 text-blue-700',green:'bg-green-50 border-green-200 text-green-700',yellow:'bg-yellow-50 border-yellow-200 text-yellow-700',red:'bg-red-50 border-red-200 text-red-700',gray:'bg-gray-50 border-gray-200 text-gray-700'}
  return <div className={`border rounded-xl p-3 ${c[color]||c.gray}`}><p className="text-xl font-bold">{value}</p><p className="text-xs font-semibold mt-0.5 opacity-70 uppercase">{label}</p></div>
}
function PriorityBadge({p}){
  const c={urgent:'bg-red-100 text-red-800',high:'bg-orange-100 text-orange-800',medium:'bg-yellow-100 text-yellow-800',low:'bg-gray-100 text-gray-600'}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${c[p]||c.medium}`}>{p}</span>
}
