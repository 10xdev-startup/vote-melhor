import type { CamaraPopularName, CamaraPropositionAuthor } from '@/types/camara'

const AUTHORS_BY_PROPOSITION: Record<number, CamaraPropositionAuthor[]> = {
  2233802: [
    {
      name: 'Reginaldo Lopes',
      party: 'PT',
      state: 'MG',
      sourceUrl: 'https://www.camara.leg.br/propostas-legislativas/2233802',
    },
  ],
}

/**
 * Nomes usados pelo próprio Portal da Câmara que não aparecem na ementa dos arquivos.
 * Cada alias mantém a página oficial que sustenta o rótulo exibido pela 10xGov.
 */
const POPULAR_NAMES_BY_PROPOSITION: Record<number, CamaraPopularName[]> = {
  2233802: [
    {
      label: 'Escala 6x1',
      sourceUrl: 'https://www.camara.leg.br/noticias/1277141-camara-aprova-em-dois-turnos-fim-da-escala-6x1-com-jornada-maxima-de-40-horas-semanais',
    },
  ],
}

const JOURNEY_BY_PROPOSITION: Record<number, string> = {
  2233802: 'scale-6x1',
}

export function popularNamesForProposition(id: number): CamaraPopularName[] {
  return [...(POPULAR_NAMES_BY_PROPOSITION[id] ?? [])]
}

export function authorsForProposition(id: number): CamaraPropositionAuthor[] {
  return [...(AUTHORS_BY_PROPOSITION[id] ?? [])]
}

export function journeyIdForProposition(id: number): string | null {
  return JOURNEY_BY_PROPOSITION[id] ?? null
}
