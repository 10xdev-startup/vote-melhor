import { apiClient } from '@/services/apiClient'
import type { LegislativeJourney } from '@/types/legislativeJourney'

export const legislativeJourneyService = {
  getJourney: (id: string) => apiClient.get<LegislativeJourney>(`/legislative-journeys/${encodeURIComponent(id)}`),
}
