import type { ClassifiedVote, VoteChoice } from '@/types/vote'

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

export interface CamaraProposition {
  id: number
  title: string | null
  summary: string | null
  apiUrl: string | null
  officialPageUrl: string
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
  propositions: CamaraProposition[]
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
