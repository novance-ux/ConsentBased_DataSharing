import { useState, useRef } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { generateAesKey, encryptFile, exportKey, arrayBufferToBase64, uint8ArrayToHex } from '@/lib/crypto'
import type { ApiResponse, DataUpload, ConsentRequest, AuditEntry } from '@/types'

type Tab = 'data' | 'requests' | 'consents' | 'audit'

export function StudentDashboard() {
  const { activeAccount } = useWallet()
  const { isAuthenticated, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('data')

  if (!isAuthenticated && !activeAccount) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Please connect your wallet or use demo login to access the Student Dashboard.</p>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'data', label: 'My Data' },
    { id: 'requests', label: 'Consent Requests' },
    { id: 'consents', label: 'Active Consents' },
    { id: 'audit', label: 'Audit Log' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Student Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your data and consent permissions
            {user?.name && <span className="ml-2 text-sm">— {user.name}</span>}
          </p>
        </div>
        {user?.credentialAsaId && (
          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
            Verified Student
          </span>
        )}
      </div>

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
        {activeTab === 'data' && <MyDataSection />}
        {activeTab === 'requests' && <ConsentRequestsSection />}
        {activeTab === 'consents' && <ActiveConsentsSection />}
        {activeTab === 'audit' && <AuditLogSection />}
      </motion.div>
    </div>
  )
}

function MyDataSection() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-uploads'],
    queryFn: () => api.get<ApiResponse<{ categories: DataUpload[] }>>('/v1/data/my-uploads'),
  })

  const uploads = data?.data?.categories ?? []

  const categories = [
    { name: 'Academic Records', key: 'academic_records', icon: '📄' },
    { name: 'Contact Info', key: 'contact_info', icon: '📧' },
    { name: 'Project Portfolio', key: 'portfolio', icon: '💼' },
    { name: 'Skills & Certifications', key: 'skills', icon: '🏆' },
    { name: 'Resume', key: 'resume', icon: '📋' },
  ]

  async function handleUpload(categoryKey: string) {
    setUploadingCategory(categoryKey)
    fileInputRef.current?.click()
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingCategory) return

    const loadingToast = toast.loading('Encrypting and uploading...')
    try {
      const arrayBuf = await file.arrayBuffer()
      const aesKey = await generateAesKey()
      const { ciphertext, iv } = await encryptFile(arrayBuf, aesKey)
      const rawKey = await exportKey(aesKey)

      const payload = {
        encryptedData: arrayBufferToBase64(ciphertext),
        encryptedAesKey: arrayBufferToBase64(rawKey),
        iv: uint8ArrayToHex(iv),
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        category: uploadingCategory,
        description: `Uploaded ${file.name}`,
      }

      await api.post('/v1/data/upload', payload)
      toast.success(`${file.name} encrypted and uploaded!`, { id: loadingToast })
      queryClient.invalidateQueries({ queryKey: ['my-uploads'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed', { id: loadingToast })
    } finally {
      setUploadingCategory(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelected} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const uploaded = uploads.filter((u) => u.category === cat.key)
          return (
            <div key={cat.key} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground">{cat.name}</h3>
                  {uploaded.length > 0 ? (
                    <p className="text-xs text-green-600">
                      {uploaded.length} file(s) uploaded
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not uploaded</p>
                  )}
                </div>
              </div>
              {uploaded.length > 0 && (
                <div className="mt-3 space-y-1">
                  {uploaded.map((u) => (
                    <div key={u.id} className="text-xs text-muted-foreground flex justify-between items-center">
                      <span className="truncate max-w-[150px]">{u.fileName}</span>
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {u.ipfsCid.slice(0, 12)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleUpload(cat.key)}
                disabled={uploadingCategory === cat.key}
                className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploadingCategory === cat.key ? 'Uploading...' : uploaded.length > 0 ? 'Upload Another' : 'Upload'}
              </button>
            </div>
          )
        })}
      </div>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading uploads...</p>}
    </>
  )
}

function ConsentRequestsSection() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['incoming-requests'],
    queryFn: () => api.get<ApiResponse<{ requests: ConsentRequest[] }>>('/v1/consent/incoming'),
  })

  const grantMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/v1/consent/grant/${requestId}`),
    onSuccess: () => {
      toast.success('Consent granted!')
      queryClient.invalidateQueries({ queryKey: ['incoming-requests'] })
      queryClient.invalidateQueries({ queryKey: ['active-consents'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/v1/consent/revoke/${requestId}`),
    onSuccess: () => {
      toast.success('Request declined')
      queryClient.invalidateQueries({ queryKey: ['incoming-requests'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const requests = data?.data?.requests ?? []
  const pending = requests.filter((r) => r.status === 'pending')
  const others = requests.filter((r) => r.status !== 'pending')

  if (isLoading) return <p className="text-muted-foreground">Loading requests...</p>

  return (
    <div className="space-y-4">
      {pending.length === 0 && others.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-muted-foreground">No consent requests received yet.</p>
        </div>
      )}
      {pending.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pending Requests</h3>
          {pending.map((req) => (
            <div key={req.id} className="rounded-xl border border-yellow-500/30 bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-card-foreground">
                    {req.requester?.name || req.requester?.walletAddress?.slice(0, 12) + '...' || 'Unknown'}
                    {req.requester?.organization && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">({req.requester.organization})</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Category: <span className="font-medium text-foreground">{req.dataCategory}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{req.message}</p>
                  {req.requestedExpiry && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(req.requestedExpiry).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600">Pending</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => grantMutation.mutate(req.id)}
                  disabled={grantMutation.isPending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {grantMutation.isPending ? 'Granting...' : 'Approve'}
                </button>
                <button
                  onClick={() => declineMutation.mutate(req.id)}
                  disabled={declineMutation.isPending}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {others.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mt-6">Past Requests</h3>
          {others.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-card-foreground">
                    {req.requester?.name || 'Unknown'} — {req.dataCategory}
                  </p>
                  <p className="text-xs text-muted-foreground">{req.message}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  req.status === 'APPROVED' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'
                }`}>
                  {req.status}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ActiveConsentsSection() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['active-consents'],
    queryFn: () => api.get<ApiResponse<{ consents: ConsentRequest[] }>>('/v1/consent/active'),
  })

  const revokeMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/v1/consent/revoke/${requestId}`),
    onSuccess: () => {
      toast.success('Consent revoked')
      queryClient.invalidateQueries({ queryKey: ['active-consents'] })
      queryClient.invalidateQueries({ queryKey: ['incoming-requests'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const consents = data?.data?.consents ?? []

  if (isLoading) return <p className="text-muted-foreground">Loading consents...</p>

  if (consents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No active consents.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Requester</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Granted</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expires</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {consents.map((c) => (
            <tr key={c.id} className="border-b border-border/50">
              <td className="py-3 px-4">{c.requester?.name || c.requester?.walletAddress?.slice(0, 12) + '...'}</td>
              <td className="py-3 px-4">{c.dataCategory}</td>
              <td className="py-3 px-4 text-muted-foreground">{c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : '—'}</td>
              <td className="py-3 px-4 text-muted-foreground">{c.requestedExpiry ? new Date(c.requestedExpiry).toLocaleDateString() : 'No expiry'}</td>
              <td className="py-3 px-4">
                <button
                  onClick={() => revokeMutation.mutate(c.id)}
                  disabled={revokeMutation.isPending}
                  className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AuditLogSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-audit'],
    queryFn: async () => {
      const user = useAuthStore.getState().user
      if (!user) return { data: { entries: [] } }
      return api.get<ApiResponse<{ entries: AuditEntry[] }>>(`/v1/audit/by-address/${user.walletAddress}`)
    },
  })

  const entries = data?.data?.entries ?? []

  if (isLoading) return <p className="text-muted-foreground">Loading audit log...</p>

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No audit log entries yet. Upload data or manage consents to create entries.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const meta = entry.metadata ? JSON.parse(entry.metadata) : {}
        return (
          <div key={entry.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">
                {entry.action === 'upload' && '📤 Uploaded'}
                {entry.action === 'download' && '📥 Downloaded'}
                {entry.action === 'consent_grant' && '✅ Consent Granted'}
                {entry.action === 'consent_revoke' && '❌ Consent Revoked'}
                {entry.action === 'credential_issue' && '🎓 Credential Issued'}
                {!['upload', 'download', 'consent_grant', 'consent_revoke', 'credential_issue'].includes(entry.action) && entry.action}
                {meta.fileName && <span className="ml-2 font-normal text-muted-foreground">— {meta.fileName}</span>}
                {meta.category && <span className="ml-1 font-normal text-muted-foreground">[{meta.category}]</span>}
              </p>
              {entry.txnId && (
                <a href={`https://lora.algokit.io/testnet/transaction/${entry.txnId}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  View on Explorer
                </a>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}
