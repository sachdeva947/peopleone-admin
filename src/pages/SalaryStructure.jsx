import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function SalaryStructure() {
  const [activeTab, setActiveTab] = useState('templates')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'templates', label: '📋 Salary Templates' },
          { key: 'assign',    label: '👤 Assign Salary' },
          { key: 'list',      label: '📊 Salary Register' },
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

      {activeTab === 'templates' && <SalaryTemplates />}
      {activeTab === 'assign'    && <AssignSalary />}
      {activeTab === 'list'      && <SalaryRegister />}
    </div>
  )
}

// ── SALARY TEMPLATES ──────────────────────────────────────────
function SalaryTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    template_name: '',
    basic_pct: 50,
    hra_pct: 40,
    conveyance_fixed: 1600,
    medical_fixed: 1250,
    special_allowance: true,
    pf_on_basic: true,
    esic_applicable: true,
  })

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data } = await supabase
      .from('salary_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTemplates(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!form.template_name) return
    setSaving(true)
    const { data: company } = await supabase.from('companies').select('id').limit(1).single()
    await supabase.from('salary_templates').insert({
      ...form,
      company_id: company?.id,
      is_active: true,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowForm(false) }, 1500)
    fetchTemplates()
  }

  function handleChange(e) {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  // Preview calculation
  const grossSample = 20000
  const basic = Math.round(grossSample * form.basic_pct / 100)
  const hra = Math.round(basic * form.hra_pct / 100)
  const conveyance = Number(form.conveyance_fixed)
  const medical = Number(form.medical_fixed)
  const special = grossSample - basic - hra - conveyance - medical
  const pfEmp = Math.min(Math.round(basic * 0.12), 1800)
  const esic = form.esic_applicable && grossSample <= 21000 ? Math.round(grossSample * 0.0075) : 0
  const netPay = grossSample - pfEmp - esic

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Salary Templates</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
        >
          + New Template
        </button>
      </div>

      {/* Add Template Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h4 className="font-semibold text-gray-700 mb-4">New Salary Template</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Template Name *</label>
              <input
                name="template_name"
                value={form.template_name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Grade A - Field Staff"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Basic (% of Gross)</label>
              <input type="number" name="basic_pct" value={form.basic_pct} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0" max="100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">HRA (% of Basic)</label>
              <input type="number" name="hra_pct" value={form.hra_pct} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0" max="100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Conveyance (Fixed ₹)</label>
              <input type="number" name="conveyance_fixed" value={form.conveyance_fixed} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Medical (Fixed ₹)</label>
              <input type="number" name="medical_fixed" value={form.medical_fixed} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6 mb-4">
            {[
              { name: 'special_allowance', label: 'Special Allowance (balancing figure)' },
              { name: 'pf_on_basic',       label: 'PF on Basic' },
              { name: 'esic_applicable',   label: 'ESIC Applicable' },
            ].map(toggle => (
              <label key={toggle.name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={toggle.name}
                  checked={form[toggle.name]}
                  onChange={handleChange}
                  className="w-4 h-4 accent-blue-900"
                />
                <span className="text-sm text-gray-600">{toggle.label}</span>
              </label>
            ))}
          </div>

          {/* Live Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-3">Live Preview — Gross ₹20,000</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500 font-medium">Earnings</p>
                <div className="flex justify-between"><span className="text-gray-600">Basic</span><span className="font-medium">₹{basic.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">HRA</span><span className="font-medium">₹{hra.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Conveyance</span><span className="font-medium">₹{conveyance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Medical</span><span className="font-medium">₹{medical.toLocaleString()}</span></div>
                {form.special_allowance && <div className="flex justify-between"><span className="text-gray-600">Special Allowance</span><span className="font-medium">₹{Math.max(0, special).toLocaleString()}</span></div>}
                <div className="flex justify-between border-t pt-1 font-semibold"><span>Gross</span><span>₹{grossSample.toLocaleString()}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500 font-medium">Deductions</p>
                <div className="flex justify-between"><span className="text-gray-600">PF (Employee)</span><span className="font-medium text-red-500">-₹{pfEmp.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">ESIC (Employee)</span><span className="font-medium text-red-500">-₹{esic.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold text-green-700"><span>Net Pay</span><span>₹{netPay.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            {saved && <span className="text-green-600 text-sm">✅ Saved!</span>}
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? <p className="text-gray-400">Loading...</p> : (
        templates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center">
            <p className="text-gray-400">No templates yet. Create your first salary template.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900">{t.template_name}</h4>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
                  <span>Basic: <b className="text-gray-700">{t.basic_pct}% of Gross</b></span>
                  <span>HRA: <b className="text-gray-700">{t.hra_pct}% of Basic</b></span>
                  <span>Conveyance: <b className="text-gray-700">₹{t.conveyance_fixed}</b></span>
                  <span>Medical: <b className="text-gray-700">₹{t.medical_fixed}</b></span>
                  <span>PF: <b className="text-gray-700">{t.pf_on_basic ? 'On Basic' : 'Custom'}</b></span>
                  <span>ESIC: <b className="text-gray-700">{t.esic_applicable ? 'Applicable' : 'N/A'}</b></span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── ASSIGN SALARY ─────────────────────────────────────────────
function AssignSalary() {
  const [employees, setEmployees] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    employee_id: '',
    template_id: '',
    effective_from: '',
    gross_monthly: '',
  })
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [{ data: emps }, { data: tmps }] = await Promise.all([
        supabase.from('employees').select('id, employee_code, first_name, last_name, designation').eq('status', 'active').order('first_name'),
        supabase.from('salary_templates').select('*').eq('is_active', true)
      ])
      if (emps) setEmployees(emps)
      if (tmps) setTemplates(tmps)
      setLoading(false)
    }
    fetchData()
  }, [])

  function calcSalary(gross, template) {
    if (!gross || !template) return null
    const g = Number(gross)
    const basic = Math.round(g * template.basic_pct / 100)
    const hra = Math.round(basic * template.hra_pct / 100)
    const conveyance = Number(template.conveyance_fixed)
    const medical = Number(template.medical_fixed)
    const special = g - basic - hra - conveyance - medical
    const pfEmp = Math.min(Math.round(basic * 0.12), 1800)
    const pfEr = Math.min(Math.round(basic * 0.12), 1800)
    const esic = template.esic_applicable && g <= 21000 ? Math.round(g * 0.0075) : 0
    const esicEr = template.esic_applicable && g <= 21000 ? Math.round(g * 0.0325) : 0
    return { basic, hra, conveyance, medical, special: Math.max(0, special), pfEmp, pfEr, esic, esicEr, netPay: g - pfEmp - esic }
  }

  function handleChange(e) {
    const newForm = { ...form, [e.target.name]: e.target.value }
    setForm(newForm)
    if (newForm.gross_monthly && newForm.template_id) {
      const template = templates.find(t => t.id === newForm.template_id)
      setPreview(calcSalary(newForm.gross_monthly, template))
    }
  }

  async function handleAssign() {
    if (!form.employee_id || !form.gross_monthly || !form.effective_from) return
    setSaving(true)
    const template = templates.find(t => t.id === form.template_id)
    const calc = calcSalary(form.gross_monthly, template)
    const gross = Number(form.gross_monthly)

    await supabase.from('employee_salary').insert({
      employee_id: form.employee_id,
      effective_from: form.effective_from,
      gross_monthly: gross,
      ctc_annual: (gross + (calc?.pfEr || 0) + (calc?.esicEr || 0)) * 12,
      basic: calc?.basic,
      hra: calc?.hra,
      conveyance: calc?.conveyance,
      medical: calc?.medical,
      special_allowance: calc?.special,
      template_id: form.template_id || null,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Assign Salary to Employee</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Employee *</label>
            <select name="employee_id" value={form.employee_id} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select Employee</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.employee_code} — {e.first_name} {e.last_name || ''} ({e.designation || ''})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Salary Template</label>
            <select name="template_id" value={form.template_id} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select Template (optional)</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.template_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Gross Monthly (₹) *</label>
            <input type="number" name="gross_monthly" value={form.gross_monthly} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="20000" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Effective From *</label>
            <input type="date" name="effective_from" value={form.effective_from} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
            <p className="text-sm font-semibold text-green-800 mb-2">Salary Breakdown</p>
            <div className="grid grid-cols-2 gap-x-6 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Basic</span><span>₹{preview.basic.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">HRA</span><span>₹{preview.hra.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Conveyance</span><span>₹{preview.conveyance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Medical</span><span>₹{preview.medical.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Special Allow.</span><span>₹{preview.special.toLocaleString()}</span></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">PF (Emp)</span><span className="text-red-500">-₹{preview.pfEmp.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">ESIC (Emp)</span><span className="text-red-500">-₹{preview.esic.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">PF (Employer)</span><span className="text-blue-600">₹{preview.pfEr.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">ESIC (Employer)</span><span className="text-blue-600">₹{preview.esicEr.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-green-700"><span>Net Pay</span><span>₹{preview.netPay.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <button onClick={handleAssign} disabled={saving}
            className="bg-blue-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Saving...' : 'Assign Salary'}
          </button>
          {saved && <span className="text-green-600 text-sm">✅ Salary assigned!</span>}
        </div>
      </div>
    </div>
  )
}

// ── SALARY REGISTER ───────────────────────────────────────────
function SalaryRegister() {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSalaries() {
      const { data } = await supabase
        .from('employee_salary')
        .select('*, employees(employee_code, first_name, last_name, designation)')
        .is('effective_to', null)
        .order('created_at', { ascending: false })
      if (data) setSalaries(data)
      setLoading(false)
    }
    fetchSalaries()
  }, [])

  if (loading) return <p className="text-gray-400">Loading...</p>

  if (salaries.length === 0) return (
    <div className="bg-white rounded-2xl shadow p-10 text-center">
      <p className="text-gray-400">No salaries assigned yet.</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Basic</th>
              <th className="px-4 py-3 text-right">HRA</th>
              <th className="px-4 py-3 text-right">CTC Annual</th>
              <th className="px-4 py-3 text-left">Effective From</th>
            </tr>
          </thead>
          <tbody>
            {salaries.map((s, i) => (
              <tr key={s.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{s.employees?.first_name} {s.employees?.last_name || ''}</p>
                  <p className="text-xs text-gray-400">{s.employees?.employee_code}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium">₹{Number(s.gross_monthly).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-500">₹{Number(s.basic).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-500">₹{Number(s.hra).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-blue-700 font-medium">₹{Number(s.ctc_annual).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(s.effective_from).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SalaryStructure