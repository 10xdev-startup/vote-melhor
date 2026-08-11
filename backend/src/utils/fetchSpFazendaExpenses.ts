import { XMLParser } from 'fast-xml-parser'
import { AppError } from '@/utils/AppError'
import type { DataFileSourceQuery } from '@/types/dataCatalog'

const ENDPOINT = 'https://webservices.fazenda.sp.gov.br/WSTransparencia/TransparenciaServico.asmx'
const SOAP_ACTION = 'http://fazenda.sp.gov.br/wstransparencia/ConsultarDespesasDotacao'
const SOURCE_TIMEOUT_MS = 90_000
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024
const CACHE_TTL_MS = 15 * 60 * 1000

interface ExpenseItem {
  CodigoNomeOrgao?: unknown
  CodigoNomeElemento?: unknown
  ValorDotacaoInicial?: unknown
  ValorDotacaoAtual?: unknown
  ValorEmpenhado?: unknown
  ValorLiquidado?: unknown
  ValorPago?: unknown
  ValorPagoAnosAnteriores?: unknown
}

interface CachedSnapshot {
  expiresAt: number
  rawXml: string
  items: ExpenseItem[]
}

const snapshots = new Map<number, CachedSnapshot>()

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName) => tagName === 'ItemDespesa',
})

function buildRequestBody(year: number): string {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><AutenticacaoHeader xmlns="http://fazenda.sp.gov.br/wstransparencia"><Usuario></Usuario><Senha></Senha></AutenticacaoHeader></soap:Header><soap:Body><ConsultarDespesasDotacao xmlns="http://fazenda.sp.gov.br/wstransparencia"><ano>${year}</ano><codigoOrgao>Detalhado</codigoOrgao><codigoUo>Consolidado</codigoUo><codigoUnidadeGestora>Consolidado</codigoUnidadeGestora><codigoFonteRecursos>Consolidado</codigoFonteRecursos><codigoFuncao>Consolidado</codigoFuncao><codigoSubfuncao>Consolidado</codigoSubfuncao><codigoPrograma>Consolidado</codigoPrograma><codigoAcao>Consolidado</codigoAcao><codigoFuncionalProgramatica>Consolidado</codigoFuncionalProgramatica><codigoCategoriaDespesa>Todos</codigoCategoriaDespesa><codigoGrupo>Todos</codigoGrupo><codigoModalidade>Todos</codigoModalidade><codigoElemento>Todos</codigoElemento><flagDotacaoInicial>true</flagDotacaoInicial><flagDotacaoAtual>true</flagDotacaoAtual><flagEmpenhado>true</flagEmpenhado><flagLiquidado>true</flagLiquidado><flagPago>true</flagPago></ConsultarDespesasDotacao></soap:Body></soap:Envelope>`
}

function readText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function readResult(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') throw new AppError(502, 'A Fazenda devolveu um XML inválido', 'SOURCE_INVALID_RESPONSE')
  const envelope = (payload as Record<string, unknown>)['Envelope']
  const body = envelope && typeof envelope === 'object' ? (envelope as Record<string, unknown>)['Body'] : undefined
  const response = body && typeof body === 'object' ? (body as Record<string, unknown>)['ConsultarDespesasDotacaoResponse'] : undefined
  const result = response && typeof response === 'object' ? (response as Record<string, unknown>)['ConsultarDespesasDotacaoResult'] : undefined
  if (!result || typeof result !== 'object') throw new AppError(502, 'A Fazenda devolveu um XML sem o resultado esperado', 'SOURCE_INVALID_RESPONSE')
  return result as Record<string, unknown>
}

export function parseSpFazendaExpensesXml(rawXml: string): ExpenseItem[] {
  let payload: unknown
  try {
    payload = parser.parse(rawXml)
  } catch {
    throw new AppError(502, 'Não foi possível ler o XML devolvido pela Fazenda', 'SOURCE_INVALID_RESPONSE')
  }

  const result = readResult(payload)
  const returnCode = readText(result['CodigoRetorno'])
  if (returnCode !== '0') {
    const description = readText(result['DescricaoCodigoRetorno']) || 'erro sem descrição'
    throw new AppError(502, `A Fazenda recusou a consulta: ${description}`, 'SOURCE_QUERY_FAILED')
  }

  const list = result['ListaItensDespesa']
  if (!list || typeof list !== 'object') return []
  const items = (list as Record<string, unknown>)['ItemDespesa']
  if (!Array.isArray(items)) return []
  return items.filter((item): item is ExpenseItem => Boolean(item) && typeof item === 'object')
}

async function fetchSnapshot(year: number): Promise<CachedSnapshot> {
  const cached = snapshots.get(year)
  if (cached && cached.expiresAt > Date.now()) return cached

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: SOAP_ACTION, 'User-Agent': '10xGov/1.0 (+https://github.com/10xdev/10x-gov)' },
      body: buildRequestBody(year),
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new AppError(504, 'A Fazenda não respondeu a tempo', 'SOURCE_TIMEOUT')
    const cause = error instanceof Error ? (error.cause ?? error.message) : error
    console.error('[fazenda-sp] falha ao consultar a origem', { year, cause })
    throw new AppError(502, 'A API da Fazenda não respondeu', 'SOURCE_UNAVAILABLE')
  }

  if (!response.ok) throw new AppError(502, `A Fazenda respondeu ${response.status}`, 'SOURCE_UNAVAILABLE')
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new AppError(502, 'A resposta da Fazenda excedeu o limite de segurança', 'SOURCE_TOO_LARGE')

  const rawXml = await response.text()
  if (Buffer.byteLength(rawXml) > MAX_RESPONSE_BYTES) throw new AppError(502, 'A resposta da Fazenda excedeu o limite de segurança', 'SOURCE_TOO_LARGE')
  const snapshot = { expiresAt: Date.now() + CACHE_TTL_MS, rawXml, items: parseSpFazendaExpensesXml(rawXml) }
  snapshots.set(year, snapshot)
  return snapshot
}

function classifyNature(element: string): { prefix: '44' | '45'; label: string } | undefined {
  const code = element.match(/^\s*(\d{2})/)?.[1]
  if (code === '44') return { prefix: '44', label: 'Investimentos' }
  if (code === '45') return { prefix: '45', label: 'Inversões financeiras' }
  return undefined
}

/**
 * Consulta o XML bruto do SIAFEM e devolve somente as linhas 44/45, sem recalcular valores.
 * A seleção é local porque o filtro `codigoGrupo` do serviço retorna zero itens para esses
 * códigos; a resposta completa permanece preservada no snapshot em memória.
 */
export async function fetchSpFazendaExpenses(query: DataFileSourceQuery): Promise<Buffer> {
  const snapshot = await fetchSnapshot(query.year)
  const allowed = new Set(query.naturePrefixes)
  const records = snapshot.items.flatMap((item) => {
    const element = readText(item.CodigoNomeElemento)
    const nature = classifyNature(element)
    if (!nature || !allowed.has(nature.prefix)) return []
    return [{
      'Exercício': String(query.year),
      'Grupo da despesa': nature.label,
      'Órgão': readText(item.CodigoNomeOrgao),
      'Elemento da despesa': element,
      'Dotação inicial': readText(item.ValorDotacaoInicial),
      'Dotação atual': readText(item.ValorDotacaoAtual),
      'Valor empenhado': readText(item.ValorEmpenhado),
      'Valor liquidado': readText(item.ValorLiquidado),
      'Valor pago': readText(item.ValorPago),
      'Valor pago de anos anteriores': readText(item.ValorPagoAnosAnteriores),
    }]
  })
  return Buffer.from(JSON.stringify(records), 'utf8')
}

export function clearSpFazendaExpensesCache(): void {
  snapshots.clear()
}
