import algosdk from 'algosdk'

const ALGOD_URL = import.meta.env.VITE_ALGOD_URL || 'https://testnet-api.algonode.cloud'
const ALGOD_TOKEN = import.meta.env.VITE_ALGOD_TOKEN || ''

let algodClient: algosdk.Algodv2 | null = null

export function getAlgodClient(): algosdk.Algodv2 {
  if (!algodClient) {
    algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '')
  }
  return algodClient
}

export function getExplorerUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export async function checkAssetBalance(
  address: string,
  assetId: number
): Promise<boolean> {
  try {
    const client = getAlgodClient()
    const accountInfo = await client.accountInformation(address).do()
    const assets = accountInfo.assets || []
    return assets.some(
      (a) => a.assetId === BigInt(assetId) && a.amount > 0n
    )
  } catch {
    return false
  }
}
