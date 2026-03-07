import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { WalletProvider } from '@/providers/WalletProvider'
import { Layout } from '@/components/Layout'
import { Landing } from '@/pages/Landing'
import { StudentDashboard } from '@/pages/StudentDashboard'
import { RequesterDashboard } from '@/pages/RequesterDashboard'
import { AdminPanel } from '@/pages/AdminPanel'
import { AuditLog } from '@/pages/AuditLog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/requester" element={<RequesterDashboard />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/audit" element={<AuditLog />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </WalletProvider>
    </QueryClientProvider>
  )
}

export default App
