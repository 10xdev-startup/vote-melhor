/** Formatadores específicos das telas do Senado. Sem HTTP — só apresentação. */

export { formatSessionDate } from '@/lib/legislativeFormat'

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(0)}%`
}
