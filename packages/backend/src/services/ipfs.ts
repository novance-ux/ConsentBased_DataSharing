import { randomBytes } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const NFT_STORAGE_API_URL = 'https://api.nft.storage'

// Disk-backed store for demo mode when IPFS key is not configured
const DEMO_STORAGE_DIR = join(process.cwd(), '.ipfs-demo-store')

function ensureStorageDir() {
  if (!existsSync(DEMO_STORAGE_DIR)) {
    mkdirSync(DEMO_STORAGE_DIR, { recursive: true })
  }
}

export async function uploadToIpfs(data: Buffer, _fileName: string): Promise<string> {
  const apiKey = process.env.NFT_STORAGE_API_KEY
  if (!apiKey) {
    // Demo mode: store to disk so files persist across restarts
    ensureStorageDir()
    const fakeCid = `bafybeig${randomBytes(20).toString('hex')}`
    writeFileSync(join(DEMO_STORAGE_DIR, fakeCid), data)
    console.log(`[IPFS Demo] Stored ${data.length} bytes as ${fakeCid}`)
    return fakeCid
  }

  const response = await fetch(`${NFT_STORAGE_API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: new Uint8Array(data),
  })

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`)
  }

  const result = await response.json() as { ok: boolean; value: { cid: string } }
  return result.value.cid
}

export async function fetchFromIpfs(cid: string): Promise<Buffer> {
  // Check disk store first (demo mode)
  const localPath = join(DEMO_STORAGE_DIR, cid)
  if (existsSync(localPath)) {
    const local = readFileSync(localPath)
    console.log(`[IPFS Demo] Retrieved ${local.length} bytes for ${cid}`)
    return local
  }

  const response = await fetch(`https://nftstorage.link/ipfs/${cid}`)
  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
