import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import NewOrder from '@/pages/NewOrder'
import BillView from '@/pages/BillView'
import PrintBills from '@/pages/PrintBills'
import EditOrder from '@/pages/EditOrder'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewOrder />} />
            <Route path="/orders/:orderId" element={<BillView />} />
            <Route path="/orders/:orderId/edit" element={<EditOrder />} />
            <Route path="/print" element={<PrintBills />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
