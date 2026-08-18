import type { ClassifiedVote, VoteChoice } from '@/types/vote'

export interface CamaraRawDeputy {
  id: number
  name: string
  party: string | null
  state: string | null
  photoUrl: string | null
  apiUrl: string | null
  officialPageUrl: string
}

export interface CamaraRawVoting {
  id: string
  apiUrl: string | null
  date: string | null
  organ: string | null
  approval: boolean | null
  yes: number
  no: number
  other: number
  description: string | null
}

export interface CamaraRawVote {
  votingId: string
  recordedAt: string | null
  officialCode: string
  deputyId: number | null
  deputyName: string | null
  partyAtTime: string | null
  state: string | null
}

export interface CamaraRawProposition {
  id: number
  title: string | null
  summary: string | null
  apiUrl: string | null
  officialPageUrl: string
}

export interface CamaraRawAffectedProposition {
  votingId: string
  proposition: CamaraRawProposition
}

export interface CamaraVotingDataset {
  deputies: CamaraRawDeputy[]
  votings: CamaraRawVoting[]
  votes: CamaraRawVote[]
  affectedPropositions: CamaraRawAffectedProposition[]
  sourceUpdatedAt: string | null
}

export interface DeputyVotingRecord {
  deputyId: number
  recordedVoteCount: number
  presidedCount: number
  choices: Record<VoteChoice, number>
}

export interface DeputySummary {
  id: number
  name: string
  party: string | null
  state: string | null
  photoUrl: string | null
  apiUrl: string | null
  officialPageUrl: string
  record: DeputyVotingRecord
}

export interface CamaraVotingTally {
  yes: number
  no: number
  abstention: number
  obstruction: number
  notEligible: number
  unclassified: number
  totalPublished: number
}

export interface DeputyVoteRow {
  votingId: string
  date: string | null
  description: string | null
  partyAtTime: string | null
  vote: ClassifiedVote
  tally: CamaraVotingTally
  result: 'approved' | 'rejected' | null
  officialUrl: string | null
  propositions: CamaraRawProposition[]
}

export interface DeputyDetail extends DeputySummary {
  votes: DeputyVoteRow[]
}

export interface DeputiesPayload {
  collectedAt: string
  sourceUpdatedAt: string | null
  sourceUrls: string[]
  coverage: {
    year: number
    lastDate: string | null
    votingCount: number
  }
  deputies: DeputySummary[]
}

export interface CamaraVotingSummary {
  id: string
  date: string | null
  description: string | null
  result: 'approved' | 'rejected' | null
  /** Distância do empate entre Sim e Não, de 0 a 1. */
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
  proposition: CamaraRawProposition | null
  authors: CamaraPropositionAuthor[]
  popularNames: CamaraPopularName[]
  journeyId: string | null
  lastDate: string | null
  contestedCount: number
  votings: CamaraVotingSummary[]
}

export interface CamaraVotingDeputyVote {
  deputyId: number | null
  name: string | null
  party: string | null
  state: string | null
  vote: ClassifiedVote
}

export interface CamaraVotingDetail extends CamaraVotingSummary {
  propositions: CamaraRawProposition[]
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
    /** Votações únicas que atendem ao critério. */
    contestedCount: number
    /** Cards de proposição exibidos quando o filtro está ativo. */
    contestedPropositionCount: number
  }
  propositions: CamaraPropositionGroup[]
}
