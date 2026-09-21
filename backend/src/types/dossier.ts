export interface DossierContent {
  title: string
  markdown: string
  sourceId: string | null
  codeCommit: string
}

export interface DossierRow {
  slug: string
  draft: DossierContent
  published: DossierContent | null
  draft_updated_at: string
  published_at: string | null
}
