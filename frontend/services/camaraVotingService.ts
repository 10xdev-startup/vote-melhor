import { apiClient, LONG_RUNNING_TIMEOUT_MS } from '@/services/apiClient'
import type { CamaraVotingDetail, CamaraVotingsPayload } from '@/types/camaraVoting'

/** As duas leituras usam o mesmo recorte oficial de votos públicos de 2026. */
export const camaraVotingService = {
  getVotings: () => apiClient.get<CamaraVotingsPayload>('/camara/votacoes', { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
  getVoting: (id: string) => apiClient.get<CamaraVotingDetail>(`/camara/votacoes/${encodeURIComponent(id)}`, { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
}
