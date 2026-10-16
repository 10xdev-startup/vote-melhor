import { supabase } from '@/database/supabase'
import { AppError } from '@/utils/AppError'
import { anexosForDisputa } from '@/adapters/licitarDigital'
import { BRAZIL_UFS, stateResourceName } from '@/adapters/pncpProposals'
import { isZipUrl, lookupBidDocuments, zipPdfEntries } from '@/services/bidDocuments'
import { officialHttpGet } from '@/utils/officialHttpGet'
import { topicWords, type BidQuery, type FederalBid, type StoredBid } from '@/services/federalBids'

const SOURCE_ID = 'pncp-propostas'
const LEGACY_MG = 'propostas-abertas'
export const BIDS_PER_PAGE = 20
const ACCENTED: Record<string, string> = {
  'tecnologia da informacao': 'tecnologia da informação',
  informatica: 'informática',
  'licenca de software': 'licença de software',
  'software como servico': 'software como serviço',
  'locacao de software': 'locação de software',
  saude: 'saúde',
  educacao: 'educação',
  construcao: 'construção',
  alimentacao: 'alimentação',
  veiculo: 'veículo',
  seguranca: 'segurança',
  medico: 'médico',
}

export interface StoredBidList {
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

function storedBid(payload: Record<string, unknown>): StoredBid | null {
  if (typeof payload['id'] !== 'string' || typeof payload['objeto'] !== 'string' || typeof payload['modalidadeCodigo'] !== 'string') return null
  return {
    id: payload['id'],
    orgao: typeof payload['orgao'] === 'string' ? payload['orgao'] : 'Órgão público',
    unidade: typeof payload['unidade'] === 'string' ? payload['unidade'] : '',
    uf: typeof payload['uf'] === 'string' ? payload['uf'] : '',
    esfera: typeof payload['esfera'] === 'string' ? payload['esfera'] : '',
    cidade: typeof payload['cidade'] === 'string' ? payload['cidade'] : '',
    objeto: payload['objeto'],
    modalidade: typeof payload['modalidade'] === 'string' ? payload['modalidade'] : 'Contratação',
    encerramento: typeof payload['encerramento'] === 'string' ? payload['encerramento'] : '',
    valorEstimado: typeof payload['valorEstimado'] === 'number' ? payload['valorEstimado'] : null,
    pncpUrl: typeof payload['pncpUrl'] === 'string' ? payload['pncpUrl'] : '',
    disputaUrl: typeof payload['disputaUrl'] === 'string' ? payload['disputaUrl'] : null,
    modalidadeCodigo: payload['modalidadeCodigo'],
    documentos: documentsOf(payload['documentos']),
    documentosEm: typeof payload['documentosEm'] === 'string' ? payload['documentosEm'] : null,
    documentosNota: typeof payload['documentosNota'] === 'string' ? payload['documentosNota'] : null,
  }
}

function documentsOf(value: unknown): { label: string; url: string; arquivo?: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    if (typeof record['label'] !== 'string' || typeof record['url'] !== 'string') return []
    const arquivo = typeof record['arquivo'] === 'string' && record['arquivo'].length > 0 && record['arquivo'].length <= 180 ? record['arquivo'] : ''
    return [arquivo ? { label: record['label'], url: record['url'], arquivo } : { label: record['label'], url: record['url'] }]
  })
}

function brazilNow(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}`
}

function safeLike(value: string): string {
  return value.replace(/[%*,.()]/g, '').trim()
}

async function readySnapshots(uf: string) {
  const codes = uf ? [uf.toUpperCase()] : [...BRAZIL_UFS]
  const names = codes.map((code) => stateResourceName(code))
  if (!uf || uf.toUpperCase() === 'MG') names.push(LEGACY_MG)
  const resources = await supabase.from('public_data_resources').select('name,active_snapshot_id').eq('source_id', SOURCE_ID).in('name', names).not('active_snapshot_id', 'is', null)
  if (resources.error) throw resources.error
  const rows = resources.data ?? []
  const hasStateMg = rows.some((row) => row.name === stateResourceName('MG'))
  const ids = rows.filter((row) => row.name !== LEGACY_MG || !hasStateMg).map((row) => row.active_snapshot_id as string)
  if (!ids.length) return []
  const snapshots = await supabase.from('public_data_snapshots').select('id,fetched_at,verification').in('id', ids).eq('state', 'ready')
  if (snapshots.error) throw snapshots.error
  return snapshots.data ?? []
}

const PNCP_UNANSWERED = 'O PNCP não devolveu a lista de arquivos.'

function needsDocumentLookup(payload: Record<string, unknown>): boolean {
  if (typeof payload['pncpUrl'] !== 'string') return false
  const docs = documentsOf(payload['documentos'])
  const disputa = typeof payload['disputaUrl'] === 'string' ? payload['disputaUrl'] : ''
  if (disputa.includes('portaldecompraspublicas.com.br') && !docs.some((doc) => doc.url.includes('arquivos.portaldecompraspublicas.com.br'))) return true
  if (docs.length > 0) return false
  if (typeof payload['documentosEm'] !== 'string') return true
  return payload['documentosNota'] === PNCP_UNANSWERED
}

async function attachDocuments(rows: { snapshot_id: string; row_number: number; payload: Record<string, unknown> }[]): Promise<{ snapshot_id: string; row_number: number; payload: Record<string, unknown> }[]> {
  for (const row of rows) {
    if (!needsDocumentLookup(row.payload)) continue
    try {
      const lookup = await lookupBidDocuments(String(row.payload['pncpUrl']), typeof row.payload['disputaUrl'] === 'string' ? row.payload['disputaUrl'] : null)
      const confirmed = lookup.documents.length > 0 || lookup.note !== PNCP_UNANSWERED
      const payload = { ...row.payload, documentos: lookup.documents, documentosNota: lookup.note, ...(confirmed ? { documentosEm: new Date().toISOString() } : {}) }
      if (!confirmed) {
        row.payload = payload
        continue
      }
      const saved = await supabase.from('public_data_records').update({ payload }).eq('snapshot_id', row.snapshot_id).eq('row_number', row.row_number)
      if (!saved.error) row.payload = payload
    } catch { /* a página segue mesmo se um PDF não responder */ }
  }
  return rows
}

async function openZips(rows: { snapshot_id: string; row_number: number; payload: Record<string, unknown> }[]): Promise<void> {
  for (const row of rows) {
    const docs = documentsOf(row.payload['documentos'])
    if (!docs.some((doc) => isZipUrl(doc.url) && !doc.arquivo)) continue
    const next: { label: string; url: string; arquivo?: string }[] = []
    let changed = false
    for (const doc of docs) {
      if (!isZipUrl(doc.url) || doc.arquivo) {
        next.push(doc)
        continue
      }
      try {
        const url = new URL(doc.url)
        const response = await officialHttpGet(url.toString(), { timeoutMs: 45000, allowedHosts: [url.hostname], maxBytes: 20_000_000 })
        const entries = response.status === 200 ? zipPdfEntries(response.body) : []
        if (!entries.length) {
          next.push(doc)
          continue
        }
        changed = true
        for (const entry of entries) next.push({ label: entries.length === 1 ? doc.label : entry.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(), url: doc.url, arquivo: entry.name })
      } catch {
        next.push(doc)
      }
    }
    if (!changed) continue
    const payload = { ...row.payload, documentos: next }
    const saved = await supabase.from('public_data_records').update({ payload }).eq('snapshot_id', row.snapshot_id).eq('row_number', row.row_number)
    if (!saved.error) row.payload = payload
  }
}

export async function listStoredOpenBids(query: BidQuery, now = new Date(), page = 1): Promise<StoredBidList> {
  const snapshots = await readySnapshots(query.uf)
  if (!snapshots.length) throw new AppError(503, 'Ainda não há uma coleta pronta desta lista', 'BIDS_NOT_COLLECTED')
  const current = Math.max(1, page)
  const from = (current - 1) * BIDS_PER_PAGE
  let records = supabase.from('public_data_records').select('snapshot_id,row_number,payload', { count: 'exact' }).in('snapshot_id', snapshots.map((snapshot) => snapshot.id))
  if (query.esfera) records = records.filter('payload->>esfera', 'eq', query.esfera)
  if (query.modalidade) records = records.filter('payload->>modalidadeCodigo', 'eq', query.modalidade)
  const cidade = safeLike(query.cidade)
  if (cidade) records = records.filter('payload->>cidade', 'ilike', `%${cidade}%`)
  const words = topicWords(query.assunto, query.recorte).flatMap((word) => ACCENTED[word] ? [word, ACCENTED[word]] : [word]).map(safeLike).filter(Boolean)
  if (words.length) records = records.or(words.map((word) => `payload->>objeto.ilike.*${word}*`).join(','))
  records = records.or(`payload->>encerramento.gte.${brazilNow(now)},payload->>encerramento.eq.`)
  const result = await records.order('payload->>encerramento', { ascending: true }).range(from, from + BIDS_PER_PAGE - 1)
  if (result.error) throw result.error
  const rows = await attachDocuments((result.data ?? []) as { snapshot_id: string; row_number: number; payload: Record<string, unknown> }[])
  await openZips(rows)
  const bids = rows.flatMap((row) => {
    const bid = storedBid(row.payload)
    if (!bid) return []
    const anexos = anexosForDisputa(bid.disputaUrl)
    return [anexos.length ? { ...bid, anexos } : bid]
  })
  const ufs = [...new Set(snapshots.map((snapshot) => String((snapshot.verification as Record<string, unknown>)['coverageUf'] ?? '')).filter(Boolean))].sort()
  const stopped = snapshots.some((snapshot) => (snapshot.verification as Record<string, unknown>)['stopped'] === 'rate-limit') ? 'rate-limit' : snapshots.some((snapshot) => (snapshot.verification as Record<string, unknown>)['stopped'] === 'page-limit') ? 'page-limit' : 'end'
  return {
    collectedAt: snapshots.map((snapshot) => snapshot.fetched_at as string).sort().at(-1) ?? '',
    coverageUf: ufs.length === 1 ? ufs[0]! : '',
    coverageModalidade: '',
    ufs,
    stopped,
    page: current,
    pageSize: BIDS_PER_PAGE,
    total: result.count ?? bids.length,
    bids,
  }
}
