import { randomBytes } from 'crypto'

const NFT_STORAGE_API_URL = 'https://api.nft.storage'

// In-memory store for demo mode when IPFS key is not configured
const localStore = new Map<string, Buffer>()

export async function uploadToIpfs(data: Buffer, _fileName: string): Promise<string> {
  const apiKey = process.env.NFT_STORAGE_API_KEY
  if (!apiKey) {
    // Demo mode: store locally and return a fake CID
    const fakeCid = `bafybeig${randomBytes(20).toString('hex')}`
    localStore.set(fakeCid, data)
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
  // Check local store first (demo mode)
  const local = localStore.get(cid)
  if (local) {
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
