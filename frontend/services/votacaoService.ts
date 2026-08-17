import { apiClient, LONG_RUNNING_TIMEOUT_MS } from "@/services/apiClient"
import type { VotacaoDetail, VotacoesPayload } from "@/types/votacao"

/**
 * Service do dominio `votacao` (blueprint §1) — a leitura por pauta.
 *
 * Timeout longo pelo mesmo motivo do `senatorService`: na primeira requisicao o backend le 8
 * anos de votacoes na API do Senado antes de responder; depois serve do cache.
 */
export const votacaoService = {
  /** Votações nominais, da mais recente para a mais antiga (GET /votacoes). */
  getVotacoes: () => apiClient.get<VotacoesPayload>("/votacoes", { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),

  /** Uma pauta com o voto de cada senador (GET /votacoes/:id). */
  getVotacao: (id: string) => apiClient.get<VotacaoDetail>(`/votacoes/${encodeURIComponent(id)}`, { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
}
