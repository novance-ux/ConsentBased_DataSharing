import { useWallet } from '@txnlab/use-wallet-react'
import { shortenAddress } from '@/lib/algorand'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function WalletConnect() {
  const { wallets, activeWallet, activeAccount } = useWallet()
  const { isAuthenticated, demoMode } = useAuthStore()
  const { authenticating, showRolePicker, loginWithWallet, dismissRolePicker, disconnectWallet } = useWalletAuth()
  const [connecting, setConnecting] = useState<string | null>(null)

  async function handleConnect(wallet: typeof wallets[number]) {
    setConnecting(wallet.id)
    try {
      await wallet.connect()
    } catch (err) {
      console.error(`Wallet connect error (${wallet.id}):`, err)
      toast.error(
        err instanceof Error
          ? `${wallet.metadata.name}: ${err.message}`
          : `Failed to connect ${wallet.metadata.name}`
      )
    } finally {
      setConnecting(null)
    }
  }

  // Already authenticated (demo or wallet) — show in Layout header instead
  if (isAuthenticated) return null

  // Wallet connected but not yet authenticated — show role picker
  if (activeAccount) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-400">
          {shortenAddress(activeAccount.address)}
        </span>
        {showRolePicker || !isAuthenticated ? (
          <div className="flex items-center gap-1.5">
            {authenticating ? (
              <span className="text-sm text-muted-foreground animate-pulse">Authenticating...</span>
            ) : (
              <>
                <button
                  onClick={() => loginWithWallet('STUDENT')}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Student
                </button>
                <button
                  onClick={() => loginWithWallet('REQUESTER')}
                  className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Requester
                </button>
                <button
                  onClick={() => loginWithWallet('ADMIN')}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Admin
                </button>
              </>
            )}
            <button
              onClick={() => disconnectWallet()}
              className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/20 transition-colors"
              title="Disconnect wallet"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => disconnectWallet()}
            className="rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/20 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>
    )
  }

  // No wallet connected — show connect buttons
  return (
    <div className="flex items-center gap-2">
      {wallets.map((wallet) => (
        <button
          key={wallet.id}
          onClick={() => handleConnect(wallet)}
          disabled={connecting !== null}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {connecting === wallet.id ? 'Connecting...' : wallet.metadata.name}
        </button>
      ))}
    </div>
  )
}
