import { apiClient, LONG_RUNNING_TIMEOUT_MS } from "@/services/apiClient"
import type { SenatorDetail, SenatorsPayload } from "@/types/senator"

/**
 * Service do dominio `senator` (blueprint §1) — fino, sobre o `apiClient`.
 *
 * As duas chamadas usam timeout longo: na primeira requisicao o backend le 8 anos de
 * votacoes da API do Senado (~1s) antes de responder. Depois disso ele serve do cache.
 */
export const senatorService = {
  /** Senadores em exercício com o retrospecto de cada um (GET /senators). */
  getSenators: () => apiClient.get<SenatorsPayload>("/senators", { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),

  /** Retrospecto voto a voto (GET /senators/:code). */
  getSenator: (code: number) => apiClient.get<SenatorDetail>(`/senators/${code}`, { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
}
