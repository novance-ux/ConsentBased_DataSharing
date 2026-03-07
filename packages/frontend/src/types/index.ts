export interface User {
  id: string
  walletAddress: string
  role: 'student' | 'requester' | 'admin'
  name: string | null
  organization: string | null
  email: string | null
  credentialAsaId: string | null
  createdAt: string
  updatedAt: string
}

export type UserProfile = User

export interface DataUpload {
  id: string
  ownerId: string
  category: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  ipfsCid: string
  encryptedAesKey: string
  ivHex: string
  description: string | null
  createdAt: string
}

export type DataCategoryRecord = DataUpload

export interface ConsentRequest {
  id: string
  dataUploadId: string | null
  dataUpload?: DataUpload | null
  studentId: string
  student?: User
  requesterId: string
  requester?: User
  dataCategory: string
  message: string
  requestedExpiry: string | null
  status: string
  consentAsaId: string | null
  txnId: string | null
  aiSuggestion: string | null
  createdAt: string
  respondedAt: string | null
  updatedAt: string
}

export type ConsentRequestRecord = ConsentRequest

export interface AuditEntry {
  id: string
  userId: string
  action: string
  resourceId: string | null
  txnId: string | null
  metadata: string | null
  createdAt: string
}

export interface AISuggestion {
  recommendation: 'APPROVE' | 'APPROVE_WITH_LIMITS' | 'DECLINE'
  suggestedExpiryDays: number
  reasoning: string
  riskScore: number
  suggestedConditions: string[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}
