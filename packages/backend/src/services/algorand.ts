import algosdk from 'algosdk'
import { createHash } from 'crypto'

// ─── Clients ────────────────────────────────────────────────

let algodClient: algosdk.Algodv2 | null = null

export function getAlgodClient(): algosdk.Algodv2 {
  if (!algodClient) {
    algodClient = new algosdk.Algodv2(
      process.env.ALGORAND_ALGOD_TOKEN || '',
      process.env.ALGORAND_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
      process.env.ALGORAND_ALGOD_PORT || ''
    )
  }
  return algodClient
}

export function getIndexerClient(): algosdk.Indexer {
  return new algosdk.Indexer(
    '',
    process.env.ALGORAND_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud',
    process.env.ALGORAND_INDEXER_PORT || ''
  )
}

export function getExplorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`
}

// ─── Platform account (signs on behalf of the backend) ──────

function getPlatformAccount(): algosdk.Account | null {
  const mnemonic = process.env.ADMIN_WALLET_MNEMONIC
  if (!mnemonic) return null
  return algosdk.mnemonicToSecretKey(mnemonic)
}

function getPlatformSigner(): algosdk.TransactionSigner | null {
  const account = getPlatformAccount()
  if (!account) return null
  return algosdk.makeBasicAccountTransactionSigner(account)
}

// ─── Helpers ────────────────────────────────────────────────

function getAppId(envKey: string): number {
  const val = process.env[envKey]
  return val ? parseInt(val, 10) : 0
}

/** True when all 3 contract App IDs + admin mnemonic are configured */
export function isOnChainEnabled(): boolean {
  return !!(
    getPlatformAccount() &&
    getAppId('CREDENTIAL_ISSUER_APP_ID') &&
    getAppId('CONSENT_MANAGER_APP_ID') &&
    getAppId('ACCESS_LOGGER_APP_ID')
  )
}

function sha256(data: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest())
}

// ─── Credential Issuer ──────────────────────────────────────

const credentialIssuerMethods = {
  issue: new algosdk.ABIMethod({
    name: 'issue_credential',
    args: [
      { type: 'account', name: 'student' },
      { type: 'string', name: 'metadata_url' },
      { type: 'account', name: 'reserve_address' },
    ],
    returns: { type: 'uint64' },
  }),
}

/**
 * Call the CredentialIssuer smart contract to mint a credential NFT.
 * Returns { txnId, asaId } on success, or null if on-chain is disabled.
 */
export async function issueCredentialOnChain(
  studentAddress: string,
  studentId: string,
): Promise<{ txnId: string; asaId: number } | null> {
  const account = getPlatformAccount()
  const signer = getPlatformSigner()
  const appId = getAppId('CREDENTIAL_ISSUER_APP_ID')
  if (!account || !signer || !appId) return null

  const client = getAlgodClient()
  const sp = await client.getTransactionParams().do()

  const metadataUrl = `template-ipfs://{ipfscid:1:raw:reserve:sha2-256}#arc19`

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: appId,
    method: credentialIssuerMethods.issue,
    sender: account.addr.toString(),
    signer,
    suggestedParams: { ...sp, fee: 3000, flatFee: true }, // cover inner txn fees
    methodArgs: [studentAddress, metadataUrl, account.addr.toString()],
  })

  const result = await atc.execute(client, 4)
  const txnId = result.txIDs[0]
  const retVal = result.methodResults[0].returnValue
  const asaId = typeof retVal === 'bigint' ? Number(retVal) : Number(retVal)
  return { txnId, asaId }
}

// ─── Consent Manager ────────────────────────────────────────

const consentManagerMethods = {
  grant: new algosdk.ABIMethod({
    name: 'grant_consent',
    args: [
      { type: 'account', name: 'requester' },
      { type: 'string', name: 'data_cid' },
      { type: 'byte[]', name: 'data_cid_hash' },
      { type: 'string', name: 'purpose' },
      { type: 'uint64', name: 'duration_rounds' },
    ],
    returns: { type: 'uint64' },
  }),
  revoke: new algosdk.ABIMethod({
    name: 'revoke_consent',
    args: [
      { type: 'account', name: 'requester' },
      { type: 'byte[]', name: 'data_cid_hash' },
    ],
    returns: { type: 'void' },
  }),
}

/**
 * Call ConsentManager.grant_consent on-chain.
 * The platform account signs on behalf of the student in demo mode.
 * Returns { txnId, consentAsaId } or null if disabled.
 */
export async function grantConsentOnChain(
  ownerAddress: string,
  requesterAddress: string,
  dataCid: string,
  purpose: string,
  durationDays: number,
): Promise<{ txnId: string; consentAsaId: number } | null> {
  const account = getPlatformAccount()
  const signer = getPlatformSigner()
  const appId = getAppId('CONSENT_MANAGER_APP_ID')
  if (!account || !signer || !appId) return null

  const client = getAlgodClient()
  const sp = await client.getTransactionParams().do()

  const cidHash = sha256(dataCid)
  // ~4700 rounds per day on Algorand
  const durationRounds = durationDays > 0 ? durationDays * 4700 : 0

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: appId,
    method: consentManagerMethods.grant,
    sender: account.addr.toString(),
    signer,
    suggestedParams: { ...sp, fee: 3000, flatFee: true },
    methodArgs: [
      requesterAddress,
      dataCid,
      cidHash,
      purpose,
      durationRounds,
    ],
  })

  const result = await atc.execute(client, 4)
  const txnId = result.txIDs[0]
  const retVal = result.methodResults[0].returnValue
  const consentAsaId = typeof retVal === 'bigint' ? Number(retVal) : Number(retVal)
  return { txnId, consentAsaId }
}

/**
 * Call ConsentManager.revoke_consent on-chain.
 * Returns { txnId } or null if disabled.
 */
export async function revokeConsentOnChain(
  ownerAddress: string,
  requesterAddress: string,
  dataCid: string,
): Promise<{ txnId: string } | null> {
  const account = getPlatformAccount()
  const signer = getPlatformSigner()
  const appId = getAppId('CONSENT_MANAGER_APP_ID')
  if (!account || !signer || !appId) return null

  const client = getAlgodClient()
  const sp = await client.getTransactionParams().do()

  const cidHash = sha256(dataCid)

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: appId,
    method: consentManagerMethods.revoke,
    sender: account.addr.toString(),
    signer,
    suggestedParams: { ...sp, fee: 3000, flatFee: true },
    methodArgs: [requesterAddress, cidHash],
  })

  const result = await atc.execute(client, 4)
  return { txnId: result.txIDs[0] }
}

// ─── Access Logger ──────────────────────────────────────────

const accessLoggerMethods = {
  log: new algosdk.ABIMethod({
    name: 'log_action',
    args: [
      { type: 'uint8', name: 'action' },
      { type: 'account', name: 'target' },
      { type: 'byte[8]', name: 'resource_hash' },
      { type: 'uint64', name: 'consent_app_id' },
    ],
    returns: { type: 'uint64' },
  }),
}

/** Action codes matching the smart contract */
export const LOG_ACTION = {
  UPLOAD: 0,
  CONSENT_GRANT: 1,
  CONSENT_REVOKE: 2,
  DOWNLOAD: 3,
  CREDENTIAL_ISSUE: 4,
} as const

/**
 * Log an action to the on-chain AccessLogger.
 * Returns { txnId, seq } or null if disabled.
 */
export async function logActionOnChain(
  action: number,
  targetAddress: string,
  resourceId: string,
): Promise<{ txnId: string; seq: number } | null> {
  const account = getPlatformAccount()
  const signer = getPlatformSigner()
  const appId = getAppId('ACCESS_LOGGER_APP_ID')
  const consentAppId = getAppId('CONSENT_MANAGER_APP_ID')
  if (!account || !signer || !appId) return null

  const client = getAlgodClient()
  const sp = await client.getTransactionParams().do()

  // Take first 8 bytes of sha256 of resourceId
  const fullHash = sha256(resourceId)
  const resourceHash = fullHash.slice(0, 8)

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: appId,
    method: accessLoggerMethods.log,
    sender: account.addr.toString(),
    signer,
    suggestedParams: { ...sp, fee: 1000, flatFee: true },
    methodArgs: [action, targetAddress, resourceHash, consentAppId || 0],
  })

  const result = await atc.execute(client, 4)
  const txnId = result.txIDs[0]
  const retVal = result.methodResults[0].returnValue
  const seq = typeof retVal === 'bigint' ? Number(retVal) : Number(retVal)
  return { txnId, seq }
}
