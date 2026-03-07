import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { ApiResponse, User, UserProfile } from '@/types'

export function AdminPanel() {
  const { activeAccount } = useWallet()
  const { isAuthenticated, user, setAuth, setDemoMode } = useAuthStore()
  const [studentAddress, setStudentAddress] = useState('')
  const [studentId, setStudentId] = useState('')
  const queryClient = useQueryClient()
  const [loggingIn, setLoggingIn] = useState(false)

  async function handleDemoLogin() {
    setLoggingIn(true)
    try {
      const res = await api.post<ApiResponse<{ token: string; user: UserProfile }>>('/v1/auth/demo-login', { role: 'ADMIN' })
      setAuth(res.data.token, res.data.user)
      setDemoMode(true)
      toast.success(`Logged in as ${res.data.user.name || 'Admin'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  if (!isAuthenticated && !activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center max-w-md shadow-sm">
          <div className="text-4xl mb-4">⚙️</div>
          <h2 className="text-xl font-bold text-foreground">Admin Panel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Issue student credentials as blockchain NFTs and manage platform settings — powered by Algorand smart contracts.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleDemoLogin}
              disabled={loggingIn}
              className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loggingIn ? 'Logging in...' : '🚀 Quick Demo Login as Admin'}
            </button>
            <p className="text-xs text-muted-foreground">Or connect your Algorand wallet using the buttons in the header</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
      <p className="mt-2 text-muted-foreground">
        Manage platform credentials and settings
        {user?.name && <span className="ml-2 text-sm">— {user.name}</span>}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <IssueCredentialCard
          studentAddress={studentAddress}
          setStudentAddress={setStudentAddress}
          studentId={studentId}
          setStudentId={setStudentId}
          queryClient={queryClient}
        />
        <RecentActivityCard />
      </div>

      <StatsCard />
    </div>
  )
}

function IssueCredentialCard({
  studentAddress,
  setStudentAddress,
  studentId,
  setStudentId,
  queryClient,
}: {
  studentAddress: string
  setStudentAddress: (v: string) => void
  studentId: string
  setStudentId: (v: string) => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const issueMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<{ user: User }>>('/v1/admin/issue-credential', {
        studentAddress,
        studentId,
      }),
    onSuccess: (res) => {
      toast.success(`Credential issued to ${res.data.user.name || studentAddress.slice(0, 12)}!`)
      setStudentAddress('')
      setStudentId('')
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-xl font-semibold text-card-foreground">Issue Credential</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Issue a student credential NFT to grant platform access
      </p>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={studentAddress}
          onChange={(e) => setStudentAddress(e.target.value)}
          placeholder="Student wallet address (58 chars)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <input
          type="text"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="Student ID (e.g., STU-2024-001)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={() => issueMutation.mutate()}
          disabled={issueMutation.isPending || studentAddress.length !== 58 || !studentId.trim()}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {issueMutation.isPending ? 'Issuing...' : 'Issue Credential'}
        </button>
      </div>
    </motion.div>
  )
}

function RecentActivityCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => api.get<ApiResponse<{ entries: { id: string; action: string; metadata: string | null; createdAt: string }[] }>>('/v1/audit/by-address/' + encodeURIComponent(useAuthStore.getState().user?.walletAddress || '')),
    enabled: !!useAuthStore.getState().user,
  })

  const entries = data?.data?.entries ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-xl font-semibold text-card-foreground">Recent Admin Activity</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your recent actions on the platform</p>
      <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity yet</p>
        ) : (
          entries.slice(0, 10).map((entry) => {
            const meta = entry.metadata ? JSON.parse(entry.metadata) : {}
            return (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-background p-3">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{entry.action.replace('_', ' ')}</p>
                  {meta.studentId && <p className="text-xs text-muted-foreground">Student: {meta.studentId}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}

function StatsCard() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: () =>
      api.get<ApiResponse<{
        totalStudents: number
        totalConsents: number
        totalRevocations: number
        totalRequesters: number
        totalDownloads: number
      }>>('/v1/admin/stats'),
    refetchInterval: 10_000,
  })

  const stats = data?.data

  const items = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0 },
    { label: 'Consents Issued', value: stats?.totalConsents ?? 0 },
    { label: 'Revocations', value: stats?.totalRevocations ?? 0 },
    { label: 'Active Requesters', value: stats?.totalRequesters ?? 0 },
    { label: 'Total Downloads', value: stats?.totalDownloads ?? 0 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-xl font-semibold text-card-foreground">Platform Statistics</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-background p-4 text-center">
            <p className="text-2xl font-bold text-primary">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
