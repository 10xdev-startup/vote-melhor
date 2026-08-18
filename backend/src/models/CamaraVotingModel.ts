import { camaraVoteMargin, classifyCamaraVote, isContestedCamaraVoting, tallyCamaraVotes } from '@/utils/normalizeCamaraVote'
import { CAMARA_RECORD_YEAR, CAMARA_SOURCE_URLS, fetchCamaraVotingDataset } from '@/utils/fetchCamara'
import { authorsForProposition, journeyIdForProposition, popularNamesForProposition } from '@/utils/camaraPopularNames'
import type { CamaraPropositionGroup, CamaraRawAffectedProposition, CamaraRawVote, CamaraRawVoting, CamaraVotingDeputyVote, CamaraVotingDetail, CamaraVotingSummary, CamaraVotingsPayload } from '@/types/camara'

const CATEGORY_ORDER: Record<string, number> = { voted: 0, not_eligible: 1, unclassified: 2 }
const CHOICE_ORDER: Record<string, number> = { yes: 0, no: 1, abstention: 2, obstruction: 3 }

function votesByVoting(votes: readonly CamaraRawVote[]): Map<string, CamaraRawVote[]> {
  const result = new Map<string, CamaraRawVote[]>()
  for (const vote of votes) {
    const rows = result.get(vote.votingId)
    if (rows) rows.push(vote)
    else result.set(vote.votingId, [vote])
  }
  return result
}

function propositionsByVoting(items: readonly CamaraRawAffectedProposition[]): Map<string, CamaraRawAffectedProposition['proposition'][]> {
  const result = new Map<string, CamaraRawAffectedProposition['proposition'][]>()
  for (const item of items) {
    const propositions = result.get(item.votingId)
    if (propositions) propositions.push(item.proposition)
    else result.set(item.votingId, [item.proposition])
  }
  return result
}

function toSummary(voting: CamaraRawVoting, votes: readonly CamaraRawVote[]): CamaraVotingSummary {
  const tally = tallyCamaraVotes(votes.map((vote) => vote.officialCode))
  return {
    id: voting.id,
    date: voting.date,
    description: voting.description,
    result: voting.approval === null ? null : voting.approval ? 'approved' : 'rejected',
    margin: camaraVoteMargin(tally),
    contested: isContestedCamaraVoting(tally),
    tally,
    officialUrl: voting.apiUrl,
  }
}

function sortVotingSummaries(a: CamaraVotingSummary, b: CamaraVotingSummary): number {
  return (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id)
}

function sortDeputyVotes(a: CamaraVotingDeputyVote, b: CamaraVotingDeputyVote): number {
  const byCategory = (CATEGORY_ORDER[a.vote.category] ?? 9) - (CATEGORY_ORDER[b.vote.category] ?? 9)
  if (byCategory !== 0) return byCategory
  const byChoice = (CHOICE_ORDER[a.vote.choice ?? ''] ?? 9) - (CHOICE_ORDER[b.vote.choice ?? ''] ?? 9)
  if (byChoice !== 0) return byChoice
  return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
}

export const CamaraVotingModel = {
  /** Proposições afetadas e suas votações, sem eleger uma proposição principal. */
  async listVotings(): Promise<CamaraVotingsPayload> {
    const dataset = await fetchCamaraVotingDataset()
    const voteRows = votesByVoting(dataset.votes)
    const votingById = new Map(dataset.votings.map((voting) => [voting.id, voting]))
    const summaries = new Map(dataset.votings.map((voting) => [voting.id, toSummary(voting, voteRows.get(voting.id) ?? [])]))
    const groups = new Map<number, CamaraPropositionGroup>()

    for (const relation of dataset.affectedPropositions) {
      const voting = votingById.get(relation.votingId)
      if (!voting) continue
      const summary = summaries.get(voting.id)
      if (!summary) continue
      const group = groups.get(relation.proposition.id)
      if (group) {
        group.votings.push(summary)
        if (summary.contested) group.contestedCount += 1
        if ((summary.date ?? '') > (group.lastDate ?? '')) group.lastDate = summary.date
      } else {
        groups.set(relation.proposition.id, {
          proposition: relation.proposition,
          authors: authorsForProposition(relation.proposition.id),
          popularNames: popularNamesForProposition(relation.proposition.id),
          journeyId: journeyIdForProposition(relation.proposition.id),
          lastDate: summary.date,
          contestedCount: summary.contested ? 1 : 0,
          votings: [summary],
        })
      }
    }

    const propositions = [...groups.values()]
    for (const group of propositions) group.votings.sort(sortVotingSummaries)
    propositions.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || (a.proposition?.title ?? '').localeCompare(b.proposition?.title ?? '', 'pt-BR'))
    const dates = dataset.votings.map((voting) => voting.date).filter((date): date is string => date !== null).sort()

    return {
      collectedAt: new Date().toISOString(),
      sourceUpdatedAt: dataset.sourceUpdatedAt,
      sourceUrls: [...CAMARA_SOURCE_URLS],
      coverage: {
        year: CAMARA_RECORD_YEAR,
        lastDate: dates.at(-1) ?? null,
        votingCount: dataset.votings.length,
        propositionCount: propositions.length,
        relationCount: dataset.affectedPropositions.length,
        contestedCount: [...summaries.values()].filter((summary) => summary.contested).length,
        contestedPropositionCount: propositions.filter((group) => group.contestedCount > 0).length,
      },
      propositions,
    }
  },

  /** Uma votação e todas as posições individuais que a Câmara publicou. */
  async getVoting(id: string): Promise<CamaraVotingDetail | null> {
    const dataset = await fetchCamaraVotingDataset()
    const voting = dataset.votings.find((item) => item.id === id)
    if (!voting) return null

    const voteRows = dataset.votes.filter((vote) => vote.votingId === id)
    const propositions = propositionsByVoting(dataset.affectedPropositions).get(id) ?? []
    const votes: CamaraVotingDeputyVote[] = voteRows.map((vote) => ({
      deputyId: vote.deputyId,
      name: vote.deputyName,
      party: vote.partyAtTime,
      state: vote.state,
      vote: classifyCamaraVote(vote.officialCode),
    }))

    return {
      ...toSummary(voting, voteRows),
      propositions: [...propositions].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'pt-BR')),
      votes: votes.sort(sortDeputyVotes),
    }
  },
}
