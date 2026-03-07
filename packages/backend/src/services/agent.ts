import { getIndexerClient } from './algorand.js'

interface AISuggestion {
  recommendation: 'APPROVE' | 'APPROVE_WITH_LIMITS' | 'DECLINE'
  suggestedExpiryDays: number
  reasoning: string
  riskScore: number
  suggestedConditions: string[]
}

export async function analyzeRequester(
  requesterAddress: string,
  _dataCategory: string,
  _requestedExpiryDays: number
): Promise<AISuggestion> {
  try {
    const indexer = getIndexerClient()
    const accountInfo = await indexer.lookupAccountByID(requesterAddress).do()
    const txnCount = accountInfo.account?.totalAppsOptedIn || 0
    const assetCount = accountInfo.account?.totalAssetsOptedIn || 0
    const createdAt = accountInfo.account?.createdAtRound || 0n

    // Simple heuristic-based analysis
    let riskScore = 5
    const conditions: string[] = []

    if (txnCount > 10) riskScore -= 1
    if (assetCount > 5) riskScore -= 1
    if (createdAt > 0n) riskScore -= 1

    if (riskScore <= 3) {
      conditions.push('Read-only access', 'No re-sharing clause')
      return {
        recommendation: 'APPROVE',
        suggestedExpiryDays: 30,
        reasoning: `This requester has an active wallet with ${txnCount} app interactions and ${assetCount} assets, suggesting legitimate use.`,
        riskScore,
        suggestedConditions: conditions,
      }
    } else if (riskScore <= 5) {
      conditions.push('Read-only access', 'No re-sharing clause', '30-day limit')
      return {
        recommendation: 'APPROVE_WITH_LIMITS',
        suggestedExpiryDays: 30,
        reasoning: `This requester has moderate on-chain activity. We recommend limited access with conditions.`,
        riskScore,
        suggestedConditions: conditions,
      }
    } else {
      return {
        recommendation: 'DECLINE',
        suggestedExpiryDays: 0,
        reasoning: `This requester has minimal on-chain activity. We recommend declining or requesting more information.`,
        riskScore,
        suggestedConditions: [],
      }
    }
  } catch {
    return {
      recommendation: 'APPROVE_WITH_LIMITS',
      suggestedExpiryDays: 30,
      reasoning: 'Unable to fully analyze requester. Recommending limited access as a precaution.',
      riskScore: 5,
      suggestedConditions: ['Read-only access', '30-day limit'],
    }
  }
}
