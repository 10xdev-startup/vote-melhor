export const BID_TOPICS: Record<string, string[]> = {
  ti: ['software', 'tecnologia da informacao', 'informatica', 'computador', 'licenca de software'],
  saude: ['saude', 'hospital', 'medicamento', 'medico'],
  educacao: ['educacao', 'escola', 'ensino'],
  obras: ['obra', 'engenharia', 'reforma', 'construcao'],
  alimentacao: ['alimentacao', 'merenda', 'generos alimenticios'],
  transporte: ['transporte', 'veiculo', 'combustivel'],
  seguranca: ['seguranca', 'vigilancia'],
}

/** Recorte dentro de um assunto. As palavras substituem a lista larga do tema. */
export const BID_REFINEMENTS: Record<string, Record<string, string[]>> = {
  ti: {
    saas: ['saas', 'software as a service', 'software como servico', 'assinatura de software', 'locacao de software'],
  },
}

export function topicWords(assunto: string, recorte: string): string[] {
  return BID_REFINEMENTS[assunto]?.[recorte] ?? BID_TOPICS[assunto] ?? []
}

export interface BidQuery {
  uf: string
  cidade: string
  esfera: string
  modalidade: string
  assunto: string
  recorte: string
}

export interface FederalBid {
  id: string
  orgao: string
  unidade: string
  uf: string
  esfera: string
  cidade: string
  objeto: string
  modalidade: string
  encerramento: string
  valorEstimado: number | null
  pncpUrl: string
  disputaUrl: string | null
  anexos?: { name: string; label: string }[]
  documentos?: { label: string; url: string; arquivo?: string }[]
  documentosEm?: string | null
  documentosNota?: string | null
}

export interface StoredBid extends FederalBid {
  modalidadeCodigo: string
}

export interface PncpProposal {
  numeroControlePNCP?: string
  anoCompra?: number
  sequencialCompra?: number
  modalidadeId?: number
  modalidadeNome?: string
  objetoCompra?: string
  valorTotalEstimado?: number | null
  dataEncerramentoProposta?: string
  linkSistemaOrigem?: string | null
  orgaoEntidade?: { cnpj?: string; razaoSocial?: string; esferaId?: string }
  unidadeOrgao?: { ufSigla?: string; municipioNome?: string; nomeUnidade?: string }
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function toFederalBid(item: PncpProposal): FederalBid | null {
  const cnpj = item.orgaoEntidade?.cnpj
  const ano = item.anoCompra
  const sequencial = item.sequencialCompra
  const objeto = item.objetoCompra?.trim()
  if (!cnpj || !ano || !sequencial || !objeto) return null
  return {
    id: item.numeroControlePNCP ?? `${cnpj}-${ano}-${sequencial}`,
    orgao: item.orgaoEntidade?.razaoSocial ?? 'Órgão público',
    unidade: item.unidadeOrgao?.nomeUnidade ?? '',
    uf: item.unidadeOrgao?.ufSigla ?? '',
    esfera: item.orgaoEntidade?.esferaId ?? '',
    cidade: item.unidadeOrgao?.municipioNome ?? '',
    objeto,
    modalidade: item.modalidadeNome ?? 'Contratação',
    encerramento: item.dataEncerramentoProposta ?? '',
    valorEstimado: typeof item.valorTotalEstimado === 'number' ? item.valorTotalEstimado : null,
    pncpUrl: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`,
    disputaUrl: item.linkSistemaOrigem || null,
  }
}

/** Prazo sem fuso conta como horário de Brasília. Outubro não tem horário de verão. */
export function bidDeadline(value: string): number | null {
  if (!value) return null
  const hasZone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value)
  const parsed = Date.parse(hasZone ? value : `${value}-03:00`)
  return Number.isNaN(parsed) ? null : parsed
}

/** Todos os filtros precisam caber. O assunto casa se qualquer palavra fixa daquele tema aparece no objeto. */
export function matchesBid(bid: FederalBid, query: BidQuery): boolean {
  if (query.uf && bid.uf.toUpperCase() !== query.uf.toUpperCase()) return false
  if (query.cidade && !fold(bid.cidade).includes(fold(query.cidade))) return false
  if (query.esfera && bid.esfera.toUpperCase() !== query.esfera.toUpperCase()) return false
  const words = topicWords(query.assunto, query.recorte)
  if (!words.length) return true
  const objeto = fold(bid.objeto)
  return words.some((word) => objeto.includes(word))
}

export function selectOpenBids(bids: StoredBid[], query: BidQuery, now: Date, limit = 50): { total: number; bids: FederalBid[] } {
  const open = bids.filter((bid) => {
    if (query.modalidade && bid.modalidadeCodigo !== query.modalidade) return false
    const deadline = bidDeadline(bid.encerramento)
    if (deadline !== null && deadline < now.getTime()) return false
    return matchesBid(bid, query)
  })
  return {
    total: open.length,
    bids: open.slice(0, limit).map((bid) => ({
      id: bid.id, orgao: bid.orgao, unidade: bid.unidade, uf: bid.uf, esfera: bid.esfera, cidade: bid.cidade,
      objeto: bid.objeto, modalidade: bid.modalidade, encerramento: bid.encerramento, valorEstimado: bid.valorEstimado,
      pncpUrl: bid.pncpUrl, disputaUrl: bid.disputaUrl,
    })),
  }
}
