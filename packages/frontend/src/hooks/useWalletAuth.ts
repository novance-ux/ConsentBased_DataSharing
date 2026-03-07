import { useEffect, useRef, useCallback, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { ApiResponse, UserProfile } from '@/types'

/**
 * Watches wallet connection state. When a wallet connects,
 * authenticates via challenge-nonce flow. WalletConnect handshake
 * already proves address ownership; the nonce prevents direct API abuse.
 */
export function useWalletAuth() {
  const { activeAccount, activeWallet } = useWallet()
  const { isAuthenticated, setAuth, clearAuth, setDemoMode, demoMode } = useAuthStore()
  const [authenticating, setAuthenticating] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const prevAddress = useRef<string | null>(null)

  // When wallet connects and user is not yet authenticated, show role picker
  useEffect(() => {
    const address = activeAccount?.address ?? null

    // Wallet just connected
    if (address && address !== prevAddress.current && !isAuthenticated) {
      setShowRolePicker(true)
    }

    // Wallet disconnected — clear auth if it was wallet-based (not demo)
    if (!address && prevAddress.current && isAuthenticated && !demoMode) {
      clearAuth()
      toast('Wallet disconnected', { icon: '👋' })
    }

    prevAddress.current = address
  }, [activeAccount?.address, isAuthenticated, demoMode, clearAuth])

  const loginWithWallet = useCallback(async (role: 'STUDENT' | 'REQUESTER' | 'ADMIN') => {
    const address = activeAccount?.address
    if (!address) return

    setAuthenticating(true)
    setShowRolePicker(false)
    try {
      // Step 1: Get a challenge nonce from backend (bound to this address, expires in 5 min)
      const challengeRes = await api.get<ApiResponse<{ nonce: string }>>(
        `/v1/auth/challenge?address=${address}`
      )
      const nonce = challengeRes.data.nonce

      // Step 2: Send nonce + address to wallet-login (nonce proves this is a real session)
      const res = await api.post<ApiResponse<{ token: string; user: UserProfile }>>(
        '/v1/auth/wallet-login',
        { address, nonce, role }
      )
      setAuth(res.data.token, res.data.user)
      setDemoMode(false)
      toast.success(`Authenticated as ${role.toLowerCase()} with wallet`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wallet authentication failed')
    } finally {
      setAuthenticating(false)
    }
  }, [activeAccount?.address, setAuth, setDemoMode])

  const dismissRolePicker = useCallback(() => {
    setShowRolePicker(false)
  }, [])

  const disconnectWallet = useCallback(() => {
    activeWallet?.disconnect()
    if (isAuthenticated && !demoMode) {
      clearAuth()
    }
  }, [activeWallet, isAuthenticated, demoMode, clearAuth])

  return {
    authenticating,
    showRolePicker,
    loginWithWallet,
    dismissRolePicker,
    disconnectWallet,
  }
}
