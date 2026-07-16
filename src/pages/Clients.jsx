import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PAYMENT_TERMS = [10, 15, 30, 45, 60]
const BILLING_TYPES = ['fixed', 'actual_days', 'per_hire', 'retainer']

export default function Clients() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [drawer, setDrawer]       = useState(null)

  const EMPTY = {
    client_name: '', legal_name: '', gstin: '', pan: '',
    billing_address: '', state_code: '', contact_person: '',
    contact_email: '', contact_phone: '',
    payment_terms_days: 30, default_billing_type: 'actual_days',
    default_markup_pct: 15, is_active: true,
  }
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('client_name')
    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    c.gstin?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ ...c })
    setShowModal(true)
  }

  async function save() {
    if (!form.client_name) return alert('Client name required')
    setSaving(true)
    if (editing) {
      await supabase.from('clients').update(form).eq('id', editing.id)
    } else {
      await supabase.from('clients').insert(form)
    }
    setSaving(false)
    setShowModal(false)
    fetchClients()
  }

  async function toggleActive(c) {
    await supabase.from('clients').update({ is_active: !c.is_active }).eq('id', c.id)
    fetchClients()
  }

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} total · {clients.filter(c => c.is_active).length} active</p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Client
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, contact, GSTIN..."
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Client Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">GSTIN</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Payment Terms</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Billing Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No clients found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDrawer(c)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.client_name}</p>
                    {c.legal_name && c.legal_name !== c.client_name && (
                      <p className="text-xs text-gray-400">{c.legal_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{c.contact_person || '—'}</p>
                    <p className="text-xs text-gray-400">{c.contact_email || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.gstin || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">NET{c.payment_terms_days || 30}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs capitalize">
                      {c.default_billing_type?.replace('_', ' ') || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)}
                        className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => toggleActive(c)}
                        className="text-gray-400 hover:text-gray-600 text-xs">
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Client' : 'Add Client'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                  <input value={form.client_name} onChange={e => F('client_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Tata Consultancy Services" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Legal Name</label>
                  <input value={form.legal_name || ''} onChange={e => F('legal_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Legal entity name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State Code</label>
                  <input value={form.state_code || ''} onChange={e => F('state_code', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 27 (Maharashtra)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                  <input value={form.gstin || ''} onChange={e => F('gstin', e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="27AABCT1332L1ZF" maxLength={15} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PAN</label>
                  <input value={form.pan || ''} onChange={e => F('pan', e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="AABCT1332L" maxLength={10} />
                </div>
              </div>

              {/* Contact */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Contact Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
                    <input value={form.contact_person || ''} onChange={e => F('contact_person', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input value={form.contact_phone || ''} onChange={e => F('contact_phone', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input value={form.contact_email || ''} onChange={e => F('contact_email', e.target.value)}
                      type="email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Billing Address</label>
                    <textarea value={form.billing_address || ''} onChange={e => F('billing_address', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Billing Defaults */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Billing Defaults</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms</label>
                    <select value={form.payment_terms_days} onChange={e => F('payment_terms_days', +e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {PAYMENT_TERMS.map(d => <option key={d} value={d}>NET{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Default Billing Type</label>
                    <select value={form.default_billing_type || ''} onChange={e => F('default_billing_type', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {BILLING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Default Markup %</label>
                    <input type="number" value={form.default_markup_pct || ''} onChange={e => F('default_markup_pct', +e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="is_active" checked={form.is_active}
                      onChange={e => F('is_active', e.target.checked)}
                      className="rounded" />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Active client</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDrawer(null)} />
          <div className="w-96 bg-white h-full overflow-y-auto shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{drawer.client_name}</h2>
              <button onClick={() => setDrawer(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              drawer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{drawer.is_active ? 'Active' : 'Inactive'}</span>

            <div className="mt-4 space-y-3">
              {drawer.legal_name && (
                <div><p className="text-xs text-gray-500">Legal Name</p><p className="text-sm font-medium text-gray-800">{drawer.legal_name}</p></div>
              )}
              {drawer.gstin && (
                <div><p className="text-xs text-gray-500">GSTIN</p><p className="text-sm font-mono text-gray-800">{drawer.gstin}</p></div>
              )}
              {drawer.pan && (
                <div><p className="text-xs text-gray-500">PAN</p><p className="text-sm font-mono text-gray-800">{drawer.pan}</p></div>
              )}
              <div><p className="text-xs text-gray-500">Contact Person</p><p className="text-sm text-gray-800">{drawer.contact_person || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Email</p><p className="text-sm text-gray-800">{drawer.contact_email || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm text-gray-800">{drawer.contact_phone || '—'}</p></div>
              {drawer.billing_address && (
                <div><p className="text-xs text-gray-500">Billing Address</p><p className="text-sm text-gray-800 whitespace-pre-line">{drawer.billing_address}</p></div>
              )}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">Payment Terms</p><p className="text-sm text-gray-800">NET{drawer.payment_terms_days || 30}</p>
              </div>
              <div><p className="text-xs text-gray-500">Default Billing Type</p>
                <p className="text-sm text-gray-800 capitalize">{drawer.default_billing_type?.replace('_',' ') || '—'}</p>
              </div>
              <div><p className="text-xs text-gray-500">Default Markup</p><p className="text-sm text-gray-800">{drawer.default_markup_pct || 0}%</p></div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => { setDrawer(null); openEdit(drawer) }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Edit
              </button>
              <button onClick={() => { toggleActive(drawer); setDrawer(null) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                {drawer.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
