import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { base64ToArrayBuffer, importKey, decryptFile, hexToUint8Array } from '@/lib/crypto'
import type { ApiResponse, DataUpload, ConsentRequest, User, UserProfile } from '@/types'

type Tab = 'request' | 'my-requests' | 'nfts'

export function RequesterDashboard() {
  const { activeAccount } = useWallet()
  const { isAuthenticated, user, setAuth, setDemoMode } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('request')
  const [loggingIn, setLoggingIn] = useState(false)

  async function handleDemoLogin() {
    setLoggingIn(true)
    try {
      const res = await api.post<ApiResponse<{ token: string; user: UserProfile }>>('/v1/auth/demo-login', { role: 'REQUESTER' })
      setAuth(res.data.token, res.data.user)
      setDemoMode(true)
      toast.success(`Logged in as ${res.data.user.name || 'Requester'}`)
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
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-foreground">Requester Dashboard</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Search for students, request access to their data, and manage your consent NFTs — all recorded on Algorand.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleDemoLogin}
              disabled={loggingIn}
              className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loggingIn ? 'Logging in...' : '🚀 Quick Demo Login as Requester'}
            </button>
            <p className="text-xs text-muted-foreground">Or connect your Algorand wallet using the buttons in the header</p>
          </div>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'request', label: 'Request Access' },
    { id: 'my-requests', label: 'My Requests' },
    { id: 'nfts', label: 'Consent NFTs' },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Requester Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Request access to student data
        {user?.name && <span className="ml-2 text-sm">— {user.name}</span>}
      </p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-6"
      >
        {activeTab === 'request' && <RequestAccessSection />}
        {activeTab === 'my-requests' && <MyRequestsSection />}
        {activeTab === 'nfts' && <ConsentNFTsSection />}
      </motion.div>
    </div>
  )
}

function RequestAccessSection() {
  const { demoMode } = useAuthStore()
  const [studentAddress, setStudentAddress] = useState('')
  const [message, setMessage] = useState('')
  const [expiry, setExpiry] = useState('30')
  const [foundStudent, setFoundStudent] = useState<{ id: string; walletAddress: string; name: string | null } | null>(null)
  const [foundUploads, setFoundUploads] = useState<DataUpload[]>([])
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const queryClient = useQueryClient()

  const DEMO_STUDENT_ADDR = 'DEMO_STUDENT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

  async function handleSearch() {
    if (!studentAddress.trim()) return
    setSearching(true)
    try {
      const res = await api.get<ApiResponse<{ student: { id: string; walletAddress: string; name: string | null } | null; uploads: DataUpload[] }>>(`/v1/consent/search-student?address=${encodeURIComponent(studentAddress.trim())}`)
      setFoundStudent(res.data.student)
      setFoundUploads(res.data.uploads)
      setSelectedUploadId(null)
      if (!res.data.student) toast.error('No student found with that address')
      else if (res.data.uploads.length === 0) toast('Student found but has no data uploaded yet')
      else toast.success(`Found ${res.data.uploads.length} data upload(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/consent/request', {
        dataCategoryId: selectedUploadId,
        message,
        requestedExpiryDays: parseInt(expiry),
      }),
    onSuccess: () => {
      toast.success('Access request submitted!')
      setMessage('')
      setSelectedUploadId(null)
      queryClient.invalidateQueries({ queryKey: ['outgoing-requests'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="max-w-2xl space-y-6">
      {/* Step 1: Search for student */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-card-foreground mb-3">Step 1: Find Student</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={studentAddress}
            onChange={(e) => setStudentAddress(e.target.value)}
            placeholder="Enter student wallet address..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !studentAddress.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {demoMode && (
          <button
            onClick={() => setStudentAddress(DEMO_STUDENT_ADDR)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Use demo student address
          </button>
        )}
      </div>

      {/* Step 2: Select data to request */}
      {foundStudent && foundUploads.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-card-foreground mb-1">Step 2: Select Data</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Student: {foundStudent.name || foundStudent.walletAddress.slice(0, 12) + '...'}
          </p>
          <div className="space-y-2">
            {foundUploads.map((upload) => (
              <label key={upload.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedUploadId === upload.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
              }`}>
                <input
                  type="radio"
                  name="upload"
                  checked={selectedUploadId === upload.id}
                  onChange={() => setSelectedUploadId(upload.id)}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{upload.category}</p>
                  <p className="text-xs text-muted-foreground">{upload.fileName} — {(upload.fileSizeBytes / 1024).toFixed(1)} KB</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Submit request */}
      {selectedUploadId && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-card-foreground mb-3">Step 3: Submit Request</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Reason for Access</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain why you need access (min 10 chars)..."
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">{message.length}/500</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Access Duration</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || message.length < 10}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Access Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyRequestsSection() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['outgoing-requests'],
    queryFn: () => api.get<ApiResponse<{ requests: ConsentRequest[] }>>('/v1/consent/outgoing'),
  })

  const requests = data?.data?.requests ?? []

  async function handleDownload(req: ConsentRequest) {
    if (!req.dataUploadId) {
      toast.error('No data linked to this request')
      return
    }
    const loadingToast = toast.loading('Downloading and decrypting...')
    try {
      const res = await api.get<ApiResponse<{
        encryptedData: string
        encryptedAesKey: string
        ivHex: string
        fileName: string
        fileType: string
      }>>(`/v1/data/download/${req.dataUploadId}`)

      const d = res.data
      const encryptedBuf = base64ToArrayBuffer(d.encryptedData)
      const keyBuf = base64ToArrayBuffer(d.encryptedAesKey)
      const iv = hexToUint8Array(d.ivHex)
      const key = await importKey(keyBuf)
      const decrypted = await decryptFile(encryptedBuf, key, iv)

      // Trigger browser download
      const blob = new Blob([decrypted], { type: d.fileType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = d.fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${d.fileName}`, { id: loadingToast })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed', { id: loadingToast })
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading requests...</p>

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No requests sent yet. Use the &quot;Request Access&quot; tab to search for student data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-card-foreground">
                {req.dataCategory}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  from {req.student?.name || req.student?.walletAddress?.slice(0, 12) + '...'}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">{req.message}</p>
              <p className="text-xs text-muted-foreground mt-1">Requested {new Date(req.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                req.status === 'APPROVED' ? 'bg-green-500/10 text-green-600' :
                req.status === 'REVOKED' ? 'bg-red-500/10 text-red-500' :
                req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-muted text-muted-foreground'
              }`}>
                {req.status}
              </span>
              {req.status === 'APPROVED' && (
                <button
                  onClick={() => handleDownload(req)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Download Data
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ConsentNFTsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['outgoing-requests'],
    queryFn: () => api.get<ApiResponse<{ requests: ConsentRequest[] }>>('/v1/consent/outgoing'),
  })

  const approved = (data?.data?.requests ?? []).filter((r) => r.status === 'APPROVED')

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>

  if (approved.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No consent NFTs held. Approved requests will appear here as Consent NFTs.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {approved.map((req) => (
        <div key={req.id} className="rounded-xl border border-primary/20 bg-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full" />
          <div className="relative">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Consent NFT</p>
            <p className="mt-2 font-semibold text-card-foreground">{req.dataCategory}</p>
            <p className="text-sm text-muted-foreground mt-1">
              From: {req.student?.name || 'Student'}
            </p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>Granted: {req.respondedAt ? new Date(req.respondedAt).toLocaleDateString() : '—'}</p>
              <p>Expires: {req.requestedExpiry ? new Date(req.requestedExpiry).toLocaleDateString() : 'No expiry'}</p>
              {req.consentAsaId && <p>ASA ID: {req.consentAsaId}</p>}
            </div>
            <span className="mt-3 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
              Active
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
