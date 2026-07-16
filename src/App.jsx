import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

// ── Existing pages ──────────────────────────────────────────
import Dashboard        from './pages/Dashboard'
import Employees        from './pages/Employees'
import Clients          from './pages/Clients'
import Payroll          from './pages/Payroll'
import Invoicing        from './pages/Invoicing'
import Compliance       from './pages/Compliance'
import Attendance       from './pages/Attendance'
import Login            from './pages/Login'

// ── New pages (copy to src/pages/) ─────────────────────────
import ClientContracts  from './pages/ClientContracts'
import WorkOrders       from './pages/WorkOrders'
import Deployments      from './pages/Deployments'
import BillingReconciliation from './pages/BillingReconciliation'
import FlexiStaffing    from './pages/FlexiStaffing'
import RPOPipeline      from './pages/RPOPipeline'
import USStaffing       from './pages/USStaffing'
import RevenueLeakage   from './pages/RevenueLeakage'

// ── Auth guard ──────────────────────────────────────────────
// Keep your existing auth logic — just wrap protected routes in <Layout>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — all inside Layout */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/dashboard"      element={<Layout><Dashboard /></Layout>} />

        {/* People */}
        <Route path="/employees"      element={<Layout><Employees /></Layout>} />
        <Route path="/attendance"     element={<Layout><Attendance /></Layout>} />
        <Route path="/flexi"          element={<Layout><FlexiStaffing /></Layout>} />

        {/* Clients & Contracts */}
        <Route path="/clients"        element={<Layout><Clients /></Layout>} />
        <Route path="/contracts"      element={<Layout><ClientContracts /></Layout>} />
        <Route path="/work-orders"    element={<Layout><WorkOrders /></Layout>} />

        {/* Operations */}
        <Route path="/deployments"    element={<Layout><Deployments /></Layout>} />
        <Route path="/rpo"            element={<Layout><RPOPipeline /></Layout>} />
        <Route path="/us"             element={<Layout><USStaffing /></Layout>} />

        {/* Finance */}
        <Route path="/payroll"        element={<Layout><Payroll /></Layout>} />
        <Route path="/billing-recon"  element={<Layout><BillingReconciliation /></Layout>} />
        <Route path="/invoicing"      element={<Layout><Invoicing /></Layout>} />
        <Route path="/compliance"     element={<Layout><Compliance /></Layout>} />

        {/* Revenue Intelligence */}
        <Route path="/revenue-leakage" element={<Layout><RevenueLeakage /></Layout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
