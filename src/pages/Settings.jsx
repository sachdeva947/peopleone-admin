import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Settings() {
  const [activeTab, setActiveTab] = useState('company')
  
  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'company',  label: '🏢 Company' },
          { key: 'sites',    label: '📍 Client Sites' },
          { key: 'states',   label: '🗺️ State Config' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition
              ${activeTab === tab.key
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'company' && <CompanyForm />}
      {activeTab === 'sites'   && <SitesForm />}
      {activeTab === 'states'  && <StatesConfig />}
    </div>
  )
}

// ── COMPANY FORM ──────────────────────────────────────────────
function CompanyForm() {
  const [form, setForm] = useState({
  name: '', legal_name: '', pan: '', tan: '',
  cin: '', gstin: '', registered_address: '',
  pf_establishment_id: '', pf_establishment_name: '', esic_code: ''
})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [companyId, setCompanyId] = useState(null)

  useEffect(() => {
    async function fetchCompany() {
      const { data } = await supabase.from('companies').select('*').limit(1).single()
      if (data) { setForm(data); setCompanyId(data.id) }
    }
    fetchCompany()
  }, [])

  async function handleSave() {
    setLoading(true)
    if (companyId) {
      await supabase.from('companies').update(form).eq('id', companyId)
    } else {
      const { data } = await supabase.from('companies').insert(form).select().single()
      if (data) setCompanyId(data.id)
    }
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-700 mb-6">Company Master</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'name',                  label: 'Display Name',         placeholder: 'PeopleOne' },
{ name: 'legal_name',            label: 'Legal Name',           placeholder: 'PeopleOne Staffing Pvt Ltd' },
{ name: 'pan',                   label: 'PAN',                  placeholder: 'AABCP1234C' },
{ name: 'tan',                   label: 'TAN',                  placeholder: 'DELA12345B' },
{ name: 'cin',                   label: 'CIN',                  placeholder: 'U74900DL2024PTC...' },
{ name: 'gstin',                 label: 'GSTIN',                placeholder: '07AABCP1234C1Z5' },
{ name: 'pf_establishment_id',   label: 'PF Establishment ID',  placeholder: 'DLCPM0012345000' },
{ name: 'pf_establishment_name', label: 'PF Establishment Name',placeholder: 'As registered with EPFO' },
{ name: 'esic_code',             label: 'ESIC Code',            placeholder: '31-12345-101' },
        ].map(field => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {field.label}
            </label>
            <input
              type="text"
              name={field.name}
              value={form[field.name] || ''}
              onChange={handleChange}
              placeholder={field.placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Registered Address
          </label>
          <textarea
            name="registered_address"
            value={form.registered_address || ''}
            onChange={handleChange}
            rows={3}
            placeholder="Full registered address..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Company'}
        </button>
        {saved && <span className="text-green-600 text-sm">✅ Saved successfully!</span>}
      </div>
    </div>
  )
}

// ── SITES FORM ────────────────────────────────────────────────
function SitesForm() {
  const [sites, setSites] = useState([])
  const [form, setForm] = useState({
    site_name: '', client_name: '', city: '',
    state_code: '', address: '', pincode: ''
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const states = [
    { code: 'DL', name: 'Delhi' },
    { code: 'HR', name: 'Haryana' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'TG', name: 'Telangana' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'OR', name: 'Odisha' },
    { code: 'WB', name: 'West Bengal' },
    { code: 'JH', name: 'Jharkhand' },
  ]

  useEffect(() => { fetchSites() }, [])

  async function fetchSites() {
    const { data } = await supabase
      .from('client_sites')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setSites(data)
  }

  async function handleAdd() {
    if (!form.site_name || !form.state_code) return
    setLoading(true)
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    await supabase.from('client_sites').insert({
      ...form,
      company_id: company?.id,
      is_active: true
    })
    setForm({ site_name: '', client_name: '', city: '', state_code: '', address: '', pincode: '' })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchSites()
  }

  return (
    <div className="max-w-3xl">
      {/* Add Site Form */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Add Client Site</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'site_name',    label: 'Site Name *',    placeholder: 'Amazon - Bhiwandi' },
            { name: 'client_name',  label: 'Client Name',    placeholder: 'Amazon India Pvt Ltd' },
            { name: 'city',         label: 'City',           placeholder: 'Bhiwandi' },
            { name: 'pincode',      label: 'Pincode',        placeholder: '421302' },
          ].map(field => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type="text"
                value={form[field.name]}
                onChange={e => setForm({ ...form, [field.name]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">State *</label>
            <select
              value={form.state_code}
              onChange={e => setForm({ ...form, state_code: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select State</option>
              {states.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Full site address"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleAdd}
            disabled={loading}
            className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition disabled:opacity-50"
          >
            {loading ? 'Adding...' : '+ Add Site'}
          </button>
          {saved && <span className="text-green-600 text-sm">✅ Site added!</span>}
        </div>
      </div>

      {/* Sites List */}
      {sites.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Client Sites ({sites.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-4 py-2 text-left">Site Name</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">City</th>
                  <th className="px-4 py-2 text-left">State</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site, i) => (
                  <tr key={site.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium">{site.site_name}</td>
                    <td className="px-4 py-2 text-gray-500">{site.client_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{site.city || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                        {site.state_code}
                      </span>
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

// ── STATES CONFIG ─────────────────────────────────────────────
function StatesConfig() {
  const [states, setStates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStates() {
      const { data } = await supabase
        .from('state_compliance_config')
        .select('*')
        .order('state_name')
      if (data) setStates(data)
      setLoading(false)
    }
    fetchStates()
  }, [])

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">
        State Compliance Config ({states.length} states)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-center">PT</th>
              <th className="px-4 py-2 text-left">PT Freq</th>
              <th className="px-4 py-2 text-center">LWF</th>
              <th className="px-4 py-2 text-left">LWF Freq</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s, i) => (
              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium">{s.state_name}
                  <span className="text-gray-400 text-xs ml-1">({s.state_code})</span>
                </td>
                <td className="px-4 py-2 text-center">
                  {s.pt_applicable
                    ? <span className="text-green-600 font-bold">✓</span>
                    : <span className="text-red-400">✗</span>}
                </td>
                <td className="px-4 py-2 text-gray-500 capitalize">{s.pt_frequency || '—'}</td>
                <td className="px-4 py-2 text-center">
                  {s.lwf_applicable
                    ? <span className="text-green-600 font-bold">✓</span>
                    : <span className="text-red-400">✗</span>}
                </td>
                <td className="px-4 py-2 text-gray-500">{s.lwf_frequency || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Settings