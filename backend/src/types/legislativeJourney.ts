export type LegislativeJourneyStepId = 'chamber' | 'senate_committees' | 'senate_first_round' | 'senate_second_round' | 'outcome'
export type LegislativeJourneyStepState = 'completed' | 'current' | 'pending'

export interface LegislativeJourneyStepFact {
  label: string
  value: string
  kind: 'text' | 'date'
  sourceUrl: string | null
}

export interface LegislativeJourneyStep {
  id: LegislativeJourneyStepId
  label: string
  detail: string
  date: string | null
  facts: LegislativeJourneyStepFact[]
  state: LegislativeJourneyStepState
}

export interface LegislativeJourneyPublicContext {
  date: string
  description: string
  sourceUrl: string
}

export interface LegislativeJourneyCurrentWait {
  stepId: LegislativeJourneyStepId
  since: string
  nextAction: string
  responsible: {
    name: string
    party: string
    state: string
    role: string
    sourceUrl: string
  }
  formalReasonPublished: boolean
  processSourceUrl: string
  deadline: {
    description: string
    started: boolean
    sourceUrl: string
  }
  publicContext: LegislativeJourneyPublicContext[]
}

export interface LegislativeJourney {
  id: string
  identification: string
  popularName: string | null
  currentHouse: 'senate'
  currentStatus: string | null
  currentStatusAt: string | null
  sourceUpdatedAt: string | null
  collectedAt: string
  processing: boolean | null
  sourceUrl: string
  documentUrl: string | null
  currentWait: LegislativeJourneyCurrentWait | null
  quorum: {
    required: number
    total: number
    rounds: number
    unit: 'senators'
    sourceUrl: string
  }
  steps: LegislativeJourneyStep[]
  outcomes: Array<{
    condition: string
    result: string
  }>
}
