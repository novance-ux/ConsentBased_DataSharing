import { create } from 'zustand'
import type { ConsentRequestRecord, DataCategoryRecord } from '@/types'

interface ConsentState {
  incomingRequests: ConsentRequestRecord[]
  outgoingRequests: ConsentRequestRecord[]
  activeConsents: ConsentRequestRecord[]
  dataCategories: DataCategoryRecord[]
  setIncomingRequests: (requests: ConsentRequestRecord[]) => void
  setOutgoingRequests: (requests: ConsentRequestRecord[]) => void
  setActiveConsents: (consents: ConsentRequestRecord[]) => void
  setDataCategories: (categories: DataCategoryRecord[]) => void
}

export const useConsentStore = create<ConsentState>((set) => ({
  incomingRequests: [],
  outgoingRequests: [],
  activeConsents: [],
  dataCategories: [],
  setIncomingRequests: (requests) => set({ incomingRequests: requests }),
  setOutgoingRequests: (requests) => set({ outgoingRequests: requests }),
  setActiveConsents: (consents) => set({ activeConsents: consents }),
  setDataCategories: (categories) => set({ dataCategories: categories }),
}))
