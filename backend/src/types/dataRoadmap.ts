export type DataRoadmapStatus = 'available' | 'mapped' | 'discovery'

export interface DataRoadmapSource {
  label: string
  url: string
}

export interface DataRoadmapItem {
  id: string
  title: string
  description: string
  organ: string
  access: string[]
  status: DataRoadmapStatus
  officialUrl: string
  officialSources?: DataRoadmapSource[]
  nextStep: string
  catalogQuery?: string
}

export interface DataRoadmapSection {
  id: string
  title: string
  description: string
  items: DataRoadmapItem[]
}
