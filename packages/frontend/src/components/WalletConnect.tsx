import { useWallet } from '@txnlab/use-wallet-react'
import { shortenAddress } from '@/lib/algorand'

export function WalletConnect() {
  const { wallets, activeWallet, activeAccount } = useWallet()

  if (activeAccount) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-400">
          {shortenAddress(activeAccount.address)}
        </span>
        <button
          onClick={() => activeWallet?.disconnect()}
          className="rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/20 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {wallets.map((wallet) => (
        <button
          key={wallet.id}
          onClick={() => wallet.connect()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {wallet.metadata.name}
        </button>
      ))}
    </div>
  )
}
