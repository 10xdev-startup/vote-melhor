export type InvestigationStatus = 'identified' | 'documented' | 'tested' | 'consulted' | 'unavailable'

export interface InvestigationSource {
  id: string
  organization: string
  title: string
  officialUrl: string
  access: string[]
  instructions: string
  endpoint?: string
}

export interface InvestigationStep {
  id: string
  title: string
  question: string
  purpose: string
  sourceIds: string[]
  status: InvestigationStatus
  coverage: number[]
  fields: string[]
  connection: string
  sample?: { columns: string[]; rows: string[][] }
}

export interface InvestigationTrail {
  id: string
  title: string
  question: string
  description: string
  territory: string
  searchTerms: string[]
  steps: InvestigationStep[]
}
