import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { ApiResponse, AuditEntry } from '@/types'

const ACTION_ICONS: Record<string, string> = {
  upload: '📤',
  download: '📥',
  consent_grant: '✅',
  consent_revoke: '🚫',
  credential_issue: '🎓',
  login: '🔑',
}

export function AuditLog() {
  const [searchAddress, setSearchAddress] = useState('')
  const [queryAddress, setQueryAddress] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', queryAddress],
    queryFn: () =>
      api.get<ApiResponse<{ entries: AuditEntry[] }>>(`/v1/audit/by-address/${encodeURIComponent(queryAddress)}`),
    enabled: !!queryAddress,
  })

  const entries = data?.data?.entries ?? []

  function handleSearch() {
    const addr = searchAddress.trim()
    if (!addr) {
      toast.error('Enter a wallet address to search')
      return
    }
    setQueryAddress(addr)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
      <p className="mt-2 text-muted-foreground">
        View the immutable on-chain record of all data access events
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 max-w-xl"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter wallet address to search..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSearch}
            disabled={isFetching}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isFetching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </motion.div>

      <div className="mt-8">
        {!queryAddress ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <p className="text-muted-foreground">
              Enter a wallet address above to view their audit trail.
              All events are recorded immutably on the Algorand blockchain.
            </p>
            <div className="mt-4 text-sm text-muted-foreground space-y-1">
              <p><strong>Tip:</strong> Try searching for a demo address:</p>
              <button
                onClick={() => { setSearchAddress('DEMO_STUDENT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'); }}
                className="text-primary hover:underline text-xs"
              >
                DEMO_STUDENT_XXX... (Student)
              </button>
              <br />
              <button
                onClick={() => { setSearchAddress('DEMO_REQUESTER_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'); }}
                className="text-primary hover:underline text-xs"
              >
                DEMO_REQUESTER_XXX... (Requester)
              </button>
              <br />
              <button
                onClick={() => { setSearchAddress('DEMO_ADMIN_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'); }}
                className="text-primary hover:underline text-xs"
              >
                DEMO_ADMIN_XXX... (Admin)
              </button>
            </div>
          </motion.div>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading audit entries...</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground">No audit entries found for this address.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found {entries.length} event{entries.length > 1 ? 's' : ''} for {queryAddress.slice(0, 16)}...
            </p>
            {entries.map((entry, idx) => {
              const meta = entry.metadata ? JSON.parse(entry.metadata) : {}
              const icon = ACTION_ICONS[entry.action] || '📋'
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <span className="text-2xl">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-card-foreground capitalize">
                        {entry.action.replace(/_/g, ' ')}
                      </p>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {entry.resourceId && (
                        <p>Resource: <code className="text-xs bg-muted px-1 rounded">{entry.resourceId}</code></p>
                      )}
                      {meta.fileName && <p>File: {meta.fileName}</p>}
                      {meta.category && <p>Category: {meta.category}</p>}
                      {meta.studentId && <p>Student ID: {meta.studentId}</p>}
                      {meta.requesterId && <p>Requester ID: {meta.requesterId.slice(0, 8)}...</p>}
                      {entry.txnId && (
                        <p>
                          Txn:{' '}
                          <a
                            href={`https://testnet.explorer.perawallet.app/tx/${entry.txnId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {entry.txnId.slice(0, 12)}...
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
