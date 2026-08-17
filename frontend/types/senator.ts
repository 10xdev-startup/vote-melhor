/** Espelha `backend/src/types/senadoVote.ts` — as categorias que o backend normaliza. */
export type VoteCategory = "voted" | "present_not_voted" | "absent" | "not_eligible" | "secret" | "unclassified"

export type VoteChoice = "yes" | "no" | "abstention" | "obstruction"

export interface ClassifiedVote {
  /** Sigla exatamente como o Senado publicou. */
  officialCode: string
  category: VoteCategory
  choice: VoteChoice | null
  /** Rótulo curto da 10xGov, para caber na linha. */
  label: string
  /** Texto oficial sem edição. `null` nos códigos que o Senado não documenta. */
  officialLabel: string | null
}

export interface VotacaoTally {
  yes: number
  no: number
  abstention: number
  obstruction: number
  presentNotVoted: number
  absent: number
  notEligible: number
  secret: number
  unclassified: number
  total: number
}

/**
 * `eligibleCount` é o denominador individual e ele varia — quem assumiu como suplente ou
 * entrou no meio do mandato aparece em menos votações. Toda tela que mostrar
 * `participationRate` precisa mostrar o denominador junto, ou a comparação mente.
 */
export interface SenatorVotingRecord {
  parliamentarianCode: number
  eligibleCount: number
  votedCount: number
  presentNotVotedCount: number
  absentCount: number
  participationRate: number | null
}

export interface SenatorSummary {
  code: number
  name: string
  party: string | null
  state: string | null
  photoUrl: string | null
  officialPageUrl: string | null
  /** Mandato termina em 31/01/2027 — a cadeira está na urna em outubro de 2026. */
  onBallot: boolean
  record: SenatorVotingRecord
}

export interface SenatorVoteRow {
  votacaoId: string
  date: string | null
  identification: string | null
  summary: string | null
  /** Partido no momento do voto, não o atual. */
  partyAtTime: string | null
  vote: ClassifiedVote
  tally: VotacaoTally
  officialUrl: string | null
}

export interface SenatorDetail extends SenatorSummary {
  votes: SenatorVoteRow[]
}

export interface SenatorsPayload {
  collectedAt: string
  sourceVersion: string | null
  coverage: { fromYear: number; toYear: number; votacaoCount: number }
  senators: SenatorSummary[]
}
