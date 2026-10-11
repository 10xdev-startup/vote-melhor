import type { OfficialRecord } from '@/types/officialData'
import { toFederalBid, type PncpProposal, type StoredBid } from '@/services/federalBids'

const PNCP = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta'
export const PNCP_RETRY_DELAYS_MS = [8_000, 20_000, 45_000] as const
export const PNCP_PAGE_PAUSE_MS = 3_000
export const PNCP_MAX_PAGES = 200
const PAGE_SIZE = 50

export interface PncpPageResponse { status: number; body: Buffer }

export interface ProposalArchive {
  uf: string
  modalidade: string
  dataFinal: string
  stopped: 'end' | 'page-limit' | 'rate-limit'
  pages: PncpProposal[][]
}

function proposalWindow(now: Date): string {
  const date = new Date(now.getTime())
  date.setUTCDate(date.getUTCDate() + 60)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function pageUrl(archive: Pick<ProposalArchive, 'uf' | 'modalidade' | 'dataFinal'>, page: number): string {
  const params = new URLSearchParams({ dataFinal: archive.dataFinal, pagina: String(page), tamanhoPagina: String(PAGE_SIZE) })
  if (archive.modalidade) params.set('codigoModalidadeContratacao', archive.modalidade)
  if (archive.uf) params.set('uf', archive.uf)
  return `${PNCP}?${params}`
}

/** 429, 5xx e falha de rede tentam de novo. 4xx de contrato volta na hora. */
async function fetchPage(get: (url: string) => Promise<PncpPageResponse>, url: string, sleep: (ms: number) => Promise<void>): Promise<PncpPageResponse> {
  let lastError: Error = new Error('PNCP não respondeu')
  for (let attempt = 0; attempt <= PNCP_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await get(url)
      if (response.status < 500 && response.status !== 429) return response
      lastError = new Error(`PNCP respondeu HTTP ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('PNCP não respondeu')
    }
    const delay = PNCP_RETRY_DELAYS_MS[attempt]
    if (delay === undefined) break
    await sleep(delay)
  }
  throw lastError
}

export async function collectOpenProposals(input: {
  uf: string
  modalidade: string
  maxPages?: number
  now?: Date
  get: (url: string) => Promise<PncpPageResponse>
  sleep?: (ms: number) => Promise<void>
  onPage?: (page: number, count: number) => void
}): Promise<ProposalArchive> {
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const maxPages = input.maxPages ?? PNCP_MAX_PAGES
  const archive: ProposalArchive = { uf: input.uf.toUpperCase(), modalidade: input.modalidade, dataFinal: proposalWindow(input.now ?? new Date()), stopped: 'page-limit', pages: [] }
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await sleep(PNCP_PAGE_PAUSE_MS)
    let response: PncpPageResponse
    try {
      response = await fetchPage(input.get, pageUrl(archive, page), sleep)
    } catch (error) {
      if (archive.pages.length) {
        archive.stopped = 'rate-limit'
        return archive
      }
      throw error
    }
    if (response.status === 204) {
      archive.stopped = 'end'
      break
    }
    if (response.status !== 200) {
      if (archive.pages.length) {
        archive.stopped = 'rate-limit'
        return archive
      }
      throw new Error(`PNCP respondeu HTTP ${response.status}`)
    }
    const payload = JSON.parse(response.body.toString('utf8')) as { data?: PncpProposal[]; paginasRestantes?: number }
    const items = payload.data ?? []
    if (!items.length) {
      archive.stopped = 'end'
      break
    }
    archive.pages.push(items)
    input.onPage?.(page, items.length)
    if (payload.paginasRestantes === 0) {
      archive.stopped = 'end'
      break
    }
    if (page === maxPages) archive.stopped = 'page-limit'
  }
  if (!archive.pages.length) throw new Error('PNCP não devolveu contratação aberta')
  return archive
}

export function proposalsToRecords(body: Buffer, modalidade: string): OfficialRecord[] {
  const archive = JSON.parse(body.toString('utf8')) as ProposalArchive
  const seen = new Set<string>()
  const records: OfficialRecord[] = []
  for (const page of archive.pages) {
    for (const item of page) {
      const bid = toFederalBid(item)
      if (!bid || seen.has(bid.id)) continue
      seen.add(bid.id)
      const stored: StoredBid = { ...bid, modalidadeCodigo: item.modalidadeId != null ? String(item.modalidadeId) : modalidade }
      records.push({ row_number: records.length + 1, reference_year: item.anoCompra ?? null, record_key: bid.id, payload: { ...stored } })
    }
  }
  return records
}
