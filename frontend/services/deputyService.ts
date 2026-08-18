import { apiClient, LONG_RUNNING_TIMEOUT_MS } from '@/services/apiClient'
import type { DeputiesPayload, DeputyDetail } from '@/types/deputy'

/** A primeira leitura cruza os arquivos oficiais de 2026; as seguintes vêm do cache. */
export const deputyService = {
  getDeputies: () => apiClient.get<DeputiesPayload>('/deputies', { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
  getDeputy: (id: number) => apiClient.get<DeputyDetail>(`/deputies/${id}`, { timeoutMs: LONG_RUNNING_TIMEOUT_MS }),
}

