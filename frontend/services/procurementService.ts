import { apiClient, LONG_RUNNING_TIMEOUT_MS } from '@/services/apiClient'

export interface BidQuery {
  uf?: string
  cidade?: string
  esfera?: string
  modalidade?: string
  assunto?: string
  recorte?: string
  pagina?: number
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

export interface OpenBidsPage {
  collectedAt: string
  coverageUf: string
  coverageModalidade: string
  ufs: string[]
  stopped: string
  page: number
  pageSize: number
  total: number
  bids: FederalBid[]
}

export interface BidDocumentLookup {
  documents: { label: string; url: string }[]
  checked: string[]
  note: string | null
}

export const procurementService = {
  openFederal: (query: BidQuery = {}) => {
    const params = new URLSearchParams()
    if (query.uf) params.set('uf', query.uf)
    if (query.cidade) params.set('cidade', query.cidade)
    if (query.esfera !== undefined) params.set('esfera', query.esfera)
    if (query.modalidade !== undefined) params.set('modalidade', query.modalidade)
    if (query.assunto) params.set('assunto', query.assunto)
    if (query.recorte) params.set('recorte', query.recorte)
    if (query.pagina && query.pagina > 1) params.set('pagina', String(query.pagina))
    const suffix = params.toString() ? `?${params}` : ''
    return apiClient.get<OpenBidsPage>(`/licitacoes/abertas${suffix}`, { timeoutMs: LONG_RUNNING_TIMEOUT_MS })
  },
  documents: (pncpUrl: string, disputaUrl: string | null) => {
    const params = new URLSearchParams({ pncpUrl })
    if (disputaUrl) params.set('disputaUrl', disputaUrl)
    return apiClient.get<BidDocumentLookup>(`/licitacoes/documentos?${params}`)
  },
}
