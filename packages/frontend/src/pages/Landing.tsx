import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types'
import toast from 'react-hot-toast'

interface Stats {
  totalStudents: number
  totalConsents: number
  totalRevocations: number
  totalRequesters: number
  totalDownloads: number
}

export function Landing() {
  const { activeAccount } = useWallet()
  const { isAuthenticated, user, setAuth, setDemoMode, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [loggingIn, setLoggingIn] = useState<string | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<ApiResponse<Stats>>('/v1/admin/stats'),
    refetchInterval: 10000,
  })

  const s = stats?.data

  async function handleDemoLogin(role: 'STUDENT' | 'REQUESTER' | 'ADMIN') {
    setLoggingIn(role)
    try {
      const res = await api.post<ApiResponse<{ token: string; user: { id: string; walletAddress: string; role: string; name: string | null; organization: string | null; email: string | null; credentialAsaId: string | null; createdAt: string; updatedAt: string } }>>('/v1/auth/demo-login', { role })
      setAuth(res.data.token, res.data.user as import('@/types').UserProfile)
      setDemoMode(true)
      toast.success(`Logged in as ${res.data.user.name || role}`)
      if (role === 'STUDENT') navigate('/student')
      else if (role === 'REQUESTER') navigate('/requester')
      else navigate('/admin')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoggingIn(null)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mt-16"
      >
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Consent-Based
          <span className="text-primary"> Data Sharing</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Take control of your personal data. ConsentChain uses Algorand blockchain
          to give students full ownership over who can access their academic records,
          portfolios, and personal information. Every access request requires your
          explicit on-chain consent.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-10 flex flex-col items-center gap-6"
      >
        {isAuthenticated && user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-semibold text-foreground">{user.name || user.walletAddress}</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary uppercase">{user.role}</span>
            </p>
            <div className="flex gap-3">
              {(user.role === 'STUDENT' || user.role === 'student') && (
                <Link to="/student" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                  Student Dashboard
                </Link>
              )}
              {(user.role === 'REQUESTER' || user.role === 'requester') && (
                <Link to="/requester" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                  Requester Dashboard
                </Link>
              )}
              {(user.role === 'ADMIN' || user.role === 'admin') && (
                <Link to="/admin" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                  Admin Panel
                </Link>
              )}
              <button onClick={clearAuth} className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">
                Logout
              </button>
            </div>
          </div>
        ) : activeAccount ? (
          <div className="flex gap-3">
            <Link to="/student" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
              Student Dashboard
            </Link>
            <Link to="/requester" className="rounded-lg bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors">
              Requester Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Connect your Algorand wallet or try the demo</p>
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Demo Login</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDemoLogin('STUDENT')}
                  disabled={loggingIn !== null}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loggingIn === 'STUDENT' ? 'Logging in...' : 'Login as Student'}
                </button>
                <button
                  onClick={() => handleDemoLogin('REQUESTER')}
                  disabled={loggingIn !== null}
                  className="rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {loggingIn === 'REQUESTER' ? 'Logging in...' : 'Login as Requester'}
                </button>
                <button
                  onClick={() => handleDemoLogin('ADMIN')}
                  disabled={loggingIn !== null}
                  className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loggingIn === 'ADMIN' ? 'Logging in...' : 'Login as Admin'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 max-w-4xl"
      >
        {[
          {
            title: 'On-Chain Consent',
            description: 'Every data access permission is recorded immutably on the Algorand blockchain.',
            icon: '🔗',
          },
          {
            title: 'AI-Powered Suggestions',
            description: 'Our AI agent analyzes requesters and suggests optimal consent policies.',
            icon: '🤖',
          },
          {
            title: 'Full Audit Trail',
            description: 'Track every access to your data with verifiable, tamper-proof logs.',
            icon: '📋',
          },
        ].map((feature, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold text-card-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="mt-16 mb-16 grid grid-cols-2 gap-8 sm:grid-cols-4 text-center"
      >
        <div>
          <p className="text-3xl font-bold text-primary">{s?.totalConsents ?? 0}</p>
          <p className="text-sm text-muted-foreground">Consents Issued</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-primary">{s?.totalRevocations ?? 0}</p>
          <p className="text-sm text-muted-foreground">Revocations</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-primary">{s?.totalStudents ?? 0}</p>
          <p className="text-sm text-muted-foreground">Students</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-primary">{s?.totalDownloads ?? 0}</p>
          <p className="text-sm text-muted-foreground">Data Downloads</p>
        </div>
      </motion.div>
    </div>
  )
}
