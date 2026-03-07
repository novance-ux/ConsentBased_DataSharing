import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/types'

interface AuthState {
  token: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  demoMode: boolean
  setAuth: (token: string, user: UserProfile) => void
  clearAuth: () => void
  setDemoMode: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      demoMode: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false, demoMode: false }),
      setDemoMode: (v) => set({ demoMode: v }),
    }),
    { name: 'consentchain-auth' }
  )
)
