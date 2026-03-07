import algosdk from 'algosdk'

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
