import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Employees from './pages/Employees'
import Onboarding from './pages/Onboarding'
import SalaryStructure from './pages/SalaryStructure'
import MainLayout from './layouts/MainLayout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
        <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
        <Route path="/employees" element={<MainLayout><Employees /></MainLayout>} />
        <Route path="/onboarding" element={<MainLayout><Onboarding /></MainLayout>} />
        <Route path="/salary" element={<MainLayout><SalaryStructure /></MainLayout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App