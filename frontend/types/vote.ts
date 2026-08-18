/** Categorias canônicas; cada órgão mantém seu próprio dicionário de códigos oficiais. */
export type VoteCategory = 'voted' | 'present_not_voted' | 'absent' | 'not_eligible' | 'secret' | 'unclassified'

export type VoteChoice = 'yes' | 'no' | 'abstention' | 'obstruction'

export interface ClassifiedVote {
  officialCode: string
  category: VoteCategory
  choice: VoteChoice | null
  label: string
  officialLabel: string | null
}

