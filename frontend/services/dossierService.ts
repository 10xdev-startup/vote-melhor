import { apiClient } from '@/services/apiClient'
import type { Dossier, DossierSummary } from '@/types/dossier'

export const dossierService = {
  list: (sourceId?: string) => apiClient.get<DossierSummary[]>(`/dossiers${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`),
  get: (slug: string) => apiClient.get<Dossier>(`/dossiers/${encodeURIComponent(slug)}`),
  listDrafts: () => apiClient.get<DossierSummary[]>('/dossiers/admin'),
  getDraft: (slug: string) => apiClient.get<Dossier>(`/dossiers/admin/${encodeURIComponent(slug)}`),
  publish: (slug: string, draftUpdatedAt: string) => apiClient.post<{ published: boolean }>(`/dossiers/admin/${encodeURIComponent(slug)}/publish`, { draftUpdatedAt }),
}
