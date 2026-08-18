import { buildDeputyRecord, classifyCamaraVote, tallyCamaraVotes } from '@/utils/normalizeCamaraVote'
import { CAMARA_RECORD_YEAR, CAMARA_SOURCE_URLS, fetchCamaraVotingDataset } from '@/utils/fetchCamara'
import type { CamaraRawAffectedProposition, CamaraRawVote, DeputyDetail, DeputySummary, DeputyVoteRow, DeputiesPayload } from '@/types/camara'

function codesByDeputy(votes: readonly CamaraRawVote[]): Map<number, string[]> {
  const result = new Map<number, string[]>()
  for (const vote of votes) {
    if (vote.deputyId === null) continue
    const codes = result.get(vote.deputyId)
    if (codes) codes.push(vote.officialCode)
    else result.set(vote.deputyId, [vote.officialCode])
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

export const DeputyModel = {
  /** Os 513 deputados em exercício e somente as escolhas que a Câmara publicou em 2026. */
  async listDeputies(): Promise<DeputiesPayload> {
    const dataset = await fetchCamaraVotingDataset()
    const codes = codesByDeputy(dataset.votes)
    const deputies: DeputySummary[] = dataset.deputies.map((deputy) => ({
      ...deputy,
      record: buildDeputyRecord(deputy.id, codes.get(deputy.id) ?? []),
    }))
    const dates = dataset.votings.map((voting) => voting.date).filter((date): date is string => date !== null).sort()

    return {
      collectedAt: new Date().toISOString(),
      sourceUpdatedAt: dataset.sourceUpdatedAt,
      sourceUrls: [...CAMARA_SOURCE_URLS],
      coverage: {
        year: CAMARA_RECORD_YEAR,
        lastDate: dates.at(-1) ?? null,
        votingCount: dataset.votings.length,
      },
      deputies,
    }
  },

  /** Voto a voto de 2026. `null` quando o ID não está em exercício no retrato atual. */
  async getDeputy(id: number): Promise<DeputyDetail | null> {
    const dataset = await fetchCamaraVotingDataset()
    const deputy = dataset.deputies.find((item) => item.id === id)
    if (!deputy) return null

    const votingById = new Map(dataset.votings.map((voting) => [voting.id, voting]))
    const propositions = propositionsByVoting(dataset.affectedPropositions)
    const codesByVoting = new Map<string, string[]>()
    for (const vote of dataset.votes) {
      const codes = codesByVoting.get(vote.votingId)
      if (codes) codes.push(vote.officialCode)
      else codesByVoting.set(vote.votingId, [vote.officialCode])
    }

    const deputyVotes = dataset.votes.filter((vote) => vote.deputyId === id)
    const rows: DeputyVoteRow[] = []
    for (const vote of deputyVotes) {
      const voting = votingById.get(vote.votingId)
      if (!voting) continue
      rows.push({
        votingId: voting.id,
        date: voting.date,
        description: voting.description,
        partyAtTime: vote.partyAtTime,
        vote: classifyCamaraVote(vote.officialCode),
        tally: tallyCamaraVotes(codesByVoting.get(voting.id) ?? []),
        result: voting.approval === null ? null : voting.approval ? 'approved' : 'rejected',
        officialUrl: voting.apiUrl,
        propositions: [...(propositions.get(voting.id) ?? [])].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'pt-BR')),
      })
    }
    rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.votingId.localeCompare(a.votingId))

    return {
      ...deputy,
      record: buildDeputyRecord(id, deputyVotes.map((vote) => vote.officialCode)),
      votes: rows,
    }
  },
}

