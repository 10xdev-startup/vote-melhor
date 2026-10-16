import { inflateRawSync } from 'node:zlib'
import { officialHttpGet } from '@/utils/officialHttpGet'
import { AppError } from '@/utils/AppError'

const PNCP_HOSTS = ['pncp.gov.br']
const FILE_HOSTS = ['pncp.gov.br', 'arquivos.licitardigital.com.br', 'licitar-signed-documents.s3.sa-east-1.amazonaws.com', 'd2e4y9pc28eke4.cloudfront.net', 'arquivos.portaldecompraspublicas.com.br']

export interface BidDocument {
  label: string
  url: string
  arquivo?: string
}

export interface BidDocumentLookup {
  documents: BidDocument[]
  checked: string[]
  note: string | null
}

export function licitanetSessionId(disputaUrl: string | null): string | null {
  if (!disputaUrl) return null
  try {
    const url = new URL(disputaUrl)
    if (url.hostname !== 'licitanet.com.br' && url.hostname !== 'www.licitanet.com.br') return null
    return url.pathname.match(/\/sessao\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export function documentsFromLicitanetPage(html: string): BidDocument[] {
  const encoded = html.match(/data-page="([^"]+)"/)?.[1]
  if (!encoded) return []
  const decoded = encoded.replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&')
  let page: { props?: { disputeRoom?: { notices?: unknown[] } } }
  try {
    page = JSON.parse(decoded) as { props?: { disputeRoom?: { notices?: unknown[] } } }
  } catch {
    return []
  }
  const notices = page.props?.disputeRoom?.notices
  if (!Array.isArray(notices)) return []
  const documents: BidDocument[] = []
  for (const item of notices) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record['link'] !== 'string') continue
    const url = absoluteFile(record['link'])
    if (!url) continue
    const name = typeof record['name'] === 'string' ? record['name'] : 'Edital'
    documents.push({ label: name.toLowerCase().includes('edita') ? 'Edital' : name, url })
  }
  return documents
}

export function portalProcessId(disputaUrl: string | null): string | null {
  if (!disputaUrl) return null
  try {
    const url = new URL(disputaUrl)
    if (!url.hostname.endsWith('portaldecompraspublicas.com.br')) return null
    return url.pathname.match(/-(\d+)$/)?.[1] ?? null
  } catch {
    return null
  }
}

export function documentsFromPortal(body: unknown): BidDocument[] {
  if (!Array.isArray(body)) return []
  const documents: BidDocument[] = []
  for (const item of body) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record['url'] !== 'string') continue
    const url = absoluteFile(record['url'])
    if (!url) continue
    const tipo = typeof record['tipo'] === 'string' && record['tipo'].trim() ? record['tipo'].trim() : 'Documento'
    const nome = typeof record['nome'] === 'string' ? record['nome'] : ''
    documents.push({ label: /retifica/i.test(nome) ? `${tipo} retificado` : tipo, url })
  }
  const labels = documents.map((document) => document.label)
  return documents.map((document, index) => {
    if (labels.filter((label) => label === document.label).length < 2) return document
    const order = labels.slice(0, index + 1).filter((label) => label === document.label).length
    return { ...document, label: `${document.label} ${order}` }
  })
}

export function licitarProcessId(disputaUrl: string | null): string | null {
  if (!disputaUrl) return null
  try {
    const url = new URL(disputaUrl)
    if (!url.hostname.endsWith('licitardigital.com.br')) return null
    return url.pathname.match(/\/pesquisa\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export function pncpPurchase(pncpUrl: string): { cnpj: string; ano: string; sequencial: string } | null {
  try {
    const url = new URL(pncpUrl)
    if (url.hostname !== 'pncp.gov.br') return null
    const match = url.pathname.match(/\/editais\/(\d{14})\/(\d{4})\/(\d+)/)
    if (!match) return null
    return { cnpj: match[1]!, ano: match[2]!, sequencial: match[3]! }
  } catch {
    return null
  }
}

function labelOf(item: Record<string, unknown>, fallback: string): string {
  const value = item['titulo'] ?? item['tipoDocumentoNome'] ?? item['fileDescription'] ?? item['fileName'] ?? item['nomeArquivo']
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function absoluteFile(raw: string): string | null {
  try {
    const url = new URL(raw)
    return FILE_HOSTS.includes(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

export function documentsFromPncp(body: unknown): BidDocument[] {
  const list = Array.isArray(body) ? body : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data) ? (body as { data: unknown[] }).data : []
  const documents: BidDocument[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const raw = record['url'] ?? record['uri'] ?? record['link']
    if (typeof raw !== 'string') continue
    const url = absoluteFile(raw.startsWith('http') ? raw : `https://pncp.gov.br${raw}`)
    if (url) documents.push({ label: labelOf(record, 'Documento'), url })
  }
  return documents
}

export function documentsFromLicitar(files: unknown, generated: unknown): BidDocument[] {
  const documents: BidDocument[] = []
  const fileList = files && typeof files === 'object' && Array.isArray((files as { data?: unknown }).data) ? (files as { data: unknown[] }).data : []
  for (const item of fileList) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const raw = record['pathFile'] ?? record['url']
    if (typeof raw !== 'string') continue
    const url = absoluteFile(raw)
    if (url) documents.push({ label: labelOf(record, 'Anexo'), url })
  }
  const generatedList = generated && typeof generated === 'object' && Array.isArray((generated as { data?: unknown }).data) ? (generated as { data: unknown[] }).data : []
  for (const item of generatedList) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record['url'] !== 'string') continue
    const url = absoluteFile(record['url'])
    if (url) documents.push({ label: labelOf(record, 'Documento'), url })
  }
  return documents
}

async function pncpFiles(url: string): Promise<{ status: number; body: Buffer }> {
  const delays = [0, 3000, 8000]
  let last: { status: number; body: Buffer } = { status: 503, body: Buffer.alloc(0) }
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    const response = await officialHttpGet(url, { timeoutMs: 20000, allowedHosts: PNCP_HOSTS, headers: { Accept: 'application/json' } })
    last = { status: response.status, body: response.body }
    if (last.status !== 429 && last.status < 500) return last
  }
  return last
}

async function licitarJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`https://manager-api.licitardigital.com.br${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://app2.licitardigital.com.br' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  try {
    return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    return { ok: false, status: response.status, body: null }
  }
}

export async function lookupBidDocuments(pncpUrl: string, disputaUrl: string | null): Promise<BidDocumentLookup> {
  const purchase = pncpPurchase(pncpUrl)
  if (!purchase) throw new AppError(400, 'Link do PNCP inválido', 'INVALID_PNCP_URL')
  const checked: string[] = []
  const notes: string[] = []
  let documents: BidDocument[] = []
  const listUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${purchase.cnpj}/compras/${purchase.ano}/${purchase.sequencial}/arquivos`
  const pncp = await pncpFiles(listUrl)
  if (pncp.status === 200) {
    checked.push('pncp')
    documents = documentsFromPncp(JSON.parse(pncp.body.toString('utf8')))
  } else if (pncp.status === 404 || pncp.status === 204) {
    checked.push('pncp')
  } else {
    notes.push('O PNCP não devolveu a lista de arquivos.')
  }
  const sessionId = licitanetSessionId(disputaUrl)
  if (sessionId) {
    try {
      const page = await fetch(`https://licitanet.com.br/sessao/${sessionId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', Accept: 'text/html' },
        signal: AbortSignal.timeout(20000),
      })
      if (page.ok) {
        checked.push('licitanet')
        documents = [...documents, ...documentsFromLicitanetPage(await page.text())]
      } else {
        notes.push('A Licitanet não devolveu o edital desta sessão.')
      }
    } catch {
      notes.push('A Licitanet não devolveu o edital desta sessão.')
    }
  }
  const portalId = portalProcessId(disputaUrl)
  if (portalId) {
    try {
      const portal = await fetch(`https://compras.api.portaldecompraspublicas.com.br/v2/licitacao/${portalId}/documentos/processo`, {
        headers: { Accept: 'application/json', Origin: 'https://www.portaldecompraspublicas.com.br', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(20000),
      })
      if (portal.ok) {
        checked.push('portal')
        documents = [...documents, ...documentsFromPortal(await portal.json())]
      } else {
        notes.push('O Portal de Compras Públicas não devolveu os arquivos.')
      }
    } catch {
      notes.push('O Portal de Compras Públicas não devolveu os arquivos.')
    }
  }
  const processId = licitarProcessId(disputaUrl)
  if (processId) {
    try {
      const [files, generated] = await Promise.all([
        licitarJson('/auction-notice-files/listAuctionNoticeFiles', { auctionNoticeId: Number(processId) }),
        licitarJson('/documents/generated/listPublicGeneratedDocuments', { params: { auctionId: Number(processId) } }),
      ])
      if (files.ok || generated.ok) {
        checked.push('licitar')
        documents = [...documents, ...documentsFromLicitar(files.ok ? files.body : null, generated.ok ? generated.body : null)]
      } else {
        notes.push('A plataforma da disputa não devolveu os arquivos.')
      }
    } catch {
      notes.push('A plataforma da disputa não devolveu os arquivos.')
    }
  }
  const seen = new Set<string>()
  return {
    documents: documents.filter((document) => {
      if (seen.has(document.url)) return false
      seen.add(document.url)
      return true
    }),
    checked,
    note: notes[0] ?? null,
  }
}

export function isZipUrl(raw: string): boolean {
  try {
    return new URL(raw).pathname.toLowerCase().endsWith('.zip')
  } catch {
    return false
  }
}

/** Lê os PDFs de um zip publicado (método store ou deflate). Ignora o resto. */
export function zipPdfEntries(body: Buffer): { name: string }[] {
  return readZip(body).map((entry) => ({ name: entry.name }))
}

export function zipPdfBytes(body: Buffer, name: string): Buffer | null {
  if (!name || name.length > 180 || name.includes('..') || name.includes('\\') || name.startsWith('/')) return null
  return readZip(body).find((entry) => entry.name === name)?.bytes ?? null
}

function readZip(body: Buffer): { name: string; bytes: Buffer }[] {
  const files: { name: string; bytes: Buffer }[] = []
  let offset = 0
  while (offset + 30 <= body.length && body.readUInt32LE(offset) === 0x04034b50) {
    const flags = body.readUInt16LE(offset + 6)
    const method = body.readUInt16LE(offset + 8)
    const compressed = body.readUInt32LE(offset + 18)
    const nameLength = body.readUInt16LE(offset + 26)
    const extraLength = body.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    if (flags & 0x8 || dataStart > body.length) break
    const dataEnd = dataStart + compressed
    if (dataEnd > body.length) break
    const name = body.subarray(nameStart, nameStart + nameLength).toString(flags & 0x800 ? 'utf8' : 'latin1')
    const raw = body.subarray(dataStart, dataEnd)
    offset = dataEnd
    if (name.endsWith('/') || !name.toLowerCase().endsWith('.pdf')) continue
    try {
      const bytes = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null
      if (bytes && bytes.subarray(0, 5).toString('ascii') === '%PDF-') files.push({ name, bytes })
    } catch { /* entrada ilegível não vira documento */ }
  }
  return files
}

export function allowedDocumentUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || !FILE_HOSTS.includes(url.hostname)) throw new AppError(400, 'Arquivo fora das origens permitidas', 'INVALID_DOCUMENT_URL')
  return url
}
