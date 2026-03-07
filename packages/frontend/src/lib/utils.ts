import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function explorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`
}

export function explorerAssetUrl(assetId: string | number): string {
  return `https://lora.algokit.io/testnet/asset/${assetId}`
}
