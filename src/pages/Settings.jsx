import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MODES = [
  {
    value: 'india_only',
    label: 'India Only',
    flag: '🇮🇳',
    desc: 'Payrolling, Flexi, RPO, India billing (INR)',
    color: 'orange',
  },
  {
    value: 'us_only',
    label: 'US Only',
    flag: '🇺🇸',
    desc: 'US Staffing, W2/C2C/1099, Timesheets (USD)',
    color: 'blue',
  },
  {
    value: 'both',
    label: 'India + US',
    flag: '🌐',
    desc: 'All modules, multi-currency INR + USD',
    color: 'purple',
  },
]

const TABS = ['Company Profile', 'Operating Mode', 'Currency & Tax']

export default function Settings() {
  const [tab, setTab]       = useState(0)
  const [settings, setSettings] = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [fxRate, setFxRate] = useState(null)
  const [fxLoading, setFxLoading] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()
    if (data) {
      setSettings(data)
      setForm(data)
    }
    fetchLiveFxRate()
  }

  async function fetchLiveFxRate() {
    setFxLoading(true)
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR')
      const data = await res.json()
      setFxRate(data.rates?.INR)
    } catch {
      setFxRate(null)
    }
    setFxLoading(false)
  }

  async function save() {
    setSaving(true)
    const { id, created_at, ...payload } = form
    if (settings?.id) {
      await supabase.from('company_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', settings.id)
    } else {
      await supabase.from('company_settings').insert(payload)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    fetchSettings()
    // Reload page so Layout picks up new mode
    window.dispatchEvent(new Event('company-settings-updated'))
  }

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const modeColor = {
    india_only: 'border-orange-400 bg-orange-50',
    us_only:    'border-blue-400 bg-blue-50',
    both:       'border-purple-400 bg-purple-50',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your company profile and operating mode</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Company Profile ── */}
      {tab === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
              <input value={form.company_name || ''} onChange={e => F('company_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Acme Staffing Pvt Ltd" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Legal Name</label>
              <input value={form.legal_name || ''} onChange={e => F('legal_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone || ''} onChange={e => F('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email || ''} onChange={e => F('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input value={form.website || ''} onChange={e => F('website', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <textarea value={form.address || ''} onChange={e => F('address', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 1: Operating Mode ── */}
      {tab === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose your operating model. This controls which modules are visible in the sidebar.
          </p>
          <div className="space-y-3">
            {MODES.map(m => (
              <button key={m.value} onClick={() => F('operating_mode', m.value)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                  form.operating_mode === m.value
                    ? modeColor[m.value] + ' shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{m.flag}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{m.label}</p>
                    <p className="text-sm text-gray-500">{m.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    form.operating_mode === m.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {form.operating_mode === m.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Module preview */}
          <div className="bg-gray-50 rounded-xl p-4 mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Visible Modules</p>
            <div className="flex flex-wrap gap-2">
              {getVisibleModules(form.operating_mode).map(m => (
                <span key={m} className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 shadow-sm">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Currency & Tax ── */}
      {tab === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          {/* Live FX Rate */}
          {(form.operating_mode === 'us_only' || form.operating_mode === 'both') && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase">Live Exchange Rate</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {fxLoading ? '...' : fxRate ? `1 USD = ₹${fxRate.toFixed(2)}` : `1 USD = ₹${form.usd_inr_fallback || 84}`}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {fxRate ? 'Live via frankfurter.app' : 'Using fallback rate'}
                  </p>
                </div>
                <button onClick={fetchLiveFxRate}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* India section */}
            {(form.operating_mode === 'india_only' || form.operating_mode === 'both') && (
              <>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-orange-600 uppercase mb-3">🇮🇳 India</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                  <input value={form.gstin || ''} onChange={e => F('gstin', e.target.value.toUpperCase())}
                    maxLength={15}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="27AABCT1332L1ZF" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PAN</label>
                  <input value={form.pan || ''} onChange={e => F('pan', e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="AABCT1332L" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State Code</label>
                  <input value={form.india_state_code || ''} onChange={e => F('india_state_code', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 27" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GST %</label>
                  <input type="number" value={form.gst_percent ?? 18} onChange={e => F('gst_percent', +e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="gst_applicable" checked={form.gst_applicable ?? true}
                    onChange={e => F('gst_applicable', e.target.checked)} className="rounded" />
                  <label htmlFor="gst_applicable" className="text-sm text-gray-700">GST Applicable</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="tds_applicable" checked={form.tds_applicable ?? false}
                    onChange={e => F('tds_applicable', e.target.checked)} className="rounded" />
                  <label htmlFor="tds_applicable" className="text-sm text-gray-700">TDS Applicable</label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Working Days / Month</label>
                  <input type="number" value={form.working_days_month ?? 26} onChange={e => F('working_days_month', +e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}

            {/* US section */}
            {(form.operating_mode === 'us_only' || form.operating_mode === 'both') && (
              <>
                <div className="col-span-2 pt-2">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-3">🇺🇸 United States</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">EIN</label>
                  <input value={form.ein || ''} onChange={e => F('ein', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12-3456789" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primary State</label>
                  <input value={form.us_state || ''} onChange={e => F('us_state', e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. NJ, TX, CA" maxLength={2} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fallback USD/INR Rate</label>
                  <input type="number" value={form.usd_inr_fallback ?? 84} onChange={e => F('usd_inr_fallback', +e.target.value)}
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Used if live rate is unavailable</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">✓ Saved!</span>}
        {(form.operating_mode !== settings?.operating_mode) && (
          <span className="text-orange-500 text-xs">⚠ Reload page after saving to update sidebar</span>
        )}
      </div>
    </div>
  )
}

function getVisibleModules(mode) {
  const india = ['Dashboard', 'Employees', 'Onboarding', 'Attendance', 'Flexi Workers',
                 'Clients', 'Contracts', 'Work Orders', 'Deployments', 'RPO Pipeline',
                 'Payroll', 'Billing Recon', 'Invoicing', 'Compliance']
  const us    = ['Dashboard', 'Clients', 'Work Orders', 'US Staffing',
                 'Invoicing', 'Compliance']
  const both  = [...new Set([...india, ...us])]
  if (mode === 'india_only') return india
  if (mode === 'us_only')    return us
  return both
}
