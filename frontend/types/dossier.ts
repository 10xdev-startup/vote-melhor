export interface DossierContentData {
  title: string
  markdown: string
  sourceId: string | null
  codeCommit: string
}
export interface Dossier {
  slug: string
  content: DossierContentData
  publishedAt: string | null
  draftUpdatedAt?: string
}
export interface DossierSummary {
  slug: string
  title: string
  sourceId: string | null
  published_at: string | null
  draft_updated_at?: string
}
