import type { CamaraProposition, CamaraVotingTally } from '@/types/deputy'
import type { ClassifiedVote } from '@/types/vote'

export type CamaraVotingResult = 'approved' | 'rejected' | null

export interface CamaraVotingSummary {
  id: string
  date: string | null
  description: string | null
  result: CamaraVotingResult
  margin: number | null
  contested: boolean
  tally: CamaraVotingTally
  officialUrl: string | null
}

export interface CamaraPopularName {
  label: string
  sourceUrl: string
}

export interface CamaraPropositionAuthor {
  name: string
  party: string | null
  state: string | null
  sourceUrl: string
}

export interface CamaraPropositionGroup {
  proposition: CamaraProposition | null
  authors: CamaraPropositionAuthor[]
  popularNames: CamaraPopularName[]
  journeyId: string | null
  lastDate: string | null
  contestedCount: number
  /** Cronológica crescente: preserva a ordem em que as decisões aconteceram. */
  votings: CamaraVotingSummary[]
}

export interface CamaraVotingDeputyVote {
  deputyId: number | null
  name: string | null
  /** Partido no momento do voto. */
  party: string | null
  state: string | null
  vote: ClassifiedVote
}

export interface CamaraVotingDetail extends CamaraVotingSummary {
  propositions: CamaraProposition[]
  votes: CamaraVotingDeputyVote[]
}

export interface CamaraVotingsPayload {
  collectedAt: string
  sourceUpdatedAt: string | null
  sourceUrls: string[]
  coverage: {
    year: number
    lastDate: string | null
    votingCount: number
    propositionCount: number
    relationCount: number
    contestedCount: number
    contestedPropositionCount: number
  }
  propositions: CamaraPropositionGroup[]
}
