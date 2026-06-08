import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Testing connection...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from('companies')
        .select('count')
      if (error) {
        setStatus('❌ Connection failed: ' + error.message)
      } else {
        setStatus('✅ Supabase connected successfully!')
      }
    }
    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
        <h1 className="text-4xl font-bold text-blue-900 mb-4">PeopleOne</h1>
        <p className="text-gray-500 text-lg mb-6">Staffing & Payroll Platform</p>
        <div className="bg-green-50 border border-green-200 rounded-lg px-6 py-4">
          <p className="text-green-700 font-medium">{status}</p>
        </div>
      </div>
    </div>
  )
}

export default App