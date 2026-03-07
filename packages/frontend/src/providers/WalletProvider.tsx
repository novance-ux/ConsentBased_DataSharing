import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider as TxnLabWalletProvider,
} from '@txnlab/use-wallet-react'
import { type ReactNode, useMemo } from 'react'

export function WalletProvider({ children }: { children: ReactNode }) {
  const walletManager = useMemo(() => {
    return new WalletManager({
      wallets: [
        WalletId.PERA,
        WalletId.DEFLY,
        WalletId.EXODUS,
      ],
      defaultNetwork: NetworkId.TESTNET,
    })
  }, [])

  return (
    <TxnLabWalletProvider manager={walletManager}>
      {children}
    </TxnLabWalletProvider>
  )
}
