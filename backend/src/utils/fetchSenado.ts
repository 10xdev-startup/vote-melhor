import { AppError } from '@/utils/AppError'
import type { SenadoRawProcess, SenadoRawSenator, SenadoRawVotacao, SenadoRawVote } from '@/types/senado'

/**
 * Cliente da API de dados abertos do Senado.
 *
 * Host diferente do `fetchSourceFile`: aqui e `legis.senado.leg.br`, que fecha handshake TLS
 * 1.3 normalmente (~0,35s). O downgrade para TLS 1.2 vale so para `www.senado.gov.br` e
 * `www12.senado.leg.br` — ver `investigacao-tls-senado.plan.md`. Por isso este cliente usa o
 * `fetch` global, como o da Fazenda de SP.
 *
 * `redirect: 'follow'` nao e detalhe: varios endpoints do Senado respondem 301 para um JSON
 * estatico. Sem seguir, o corpo volta vazio e o parser acusa erro de formato.
 */

const BASE_URL = 'https://legis.senado.leg.br/dadosabertos'
const SOURCE_TIMEOUT_MS = 60_000
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024
/** O Senado publica com ~4 dias de atraso; reler de hora em hora e mais que suficiente. */
const CACHE_TTL_MS = 60 * 60 * 1000

interface CachedYear {
  expiresAt: number
  votacoes: SenadoRawVotacao[]
}

interface CachedSenators {
  expiresAt: number
  senators: SenadoRawSenator[]
  sourceVersion: string | null
}

interface CachedProcess {
  expiresAt: number
  process: SenadoRawProcess | null
}

const votacoesByYear = new Map<number, CachedYear>()
let senatorsCache: CachedSenators | null = null
const processCache = new Map<string, CachedProcess>()

function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number') return String(value)
  return null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
 * O Senado publica foto e pagina do parlamentar em `http://`, e os mesmos caminhos respondem
 * 200 em `https://`. Servido numa pagina HTTPS, o `http://` vira mixed content e o browser
 * bloqueia — a foto simplesmente nao carrega em producao. Corrigir aqui, na fronteira com a
 * fonte, evita espalhar a gambiarra pela UI.
 */
function toHttps(value: string | null): string | null {
  return value?.startsWith('http://') ? `https://${value.slice('http://'.length)}` : value
}

async function requestJson(path: string, context: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': '10xGov/1.0 (+https://github.com/10xdev/10x-gov)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AppError(504, 'O Senado não respondeu a tempo', 'SOURCE_TIMEOUT')
    }
    const cause = error instanceof Error ? (error.cause ?? error.message) : error
    console.error('[senado] falha ao consultar a origem', { path, context, cause })
    throw new AppError(502, 'A API do Senado não respondeu', 'SOURCE_UNAVAILABLE')
  }

  if (!response.ok) throw new AppError(502, `O Senado respondeu ${response.status}`, 'SOURCE_UNAVAILABLE')

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new AppError(502, 'A resposta do Senado excedeu o limite de segurança', 'SOURCE_TOO_LARGE')
  }

  const body = await response.text()
  // Endpoint legado do Senado responde 200 com corpo vazio em vez de erro. Tratar como
  // sucesso registraria "zero votacoes" silenciosamente.
  if (body.trim().length === 0) throw new AppError(502, 'O Senado devolveu uma resposta vazia', 'SOURCE_EMPTY_RESPONSE')

  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new AppError(502, 'O Senado devolveu um JSON inválido', 'SOURCE_INVALID_RESPONSE')
  }
}

function toRawVote(value: unknown): SenadoRawVote | null {
  const row = readRecord(value)
  if (!row) return null
  return {
    codigoParlamentar: readNumber(row['codigoParlamentar']),
    nomeParlamentar: readString(row['nomeParlamentar']),
    siglaPartidoParlamentar: readString(row['siglaPartidoParlamentar']),
    siglaUFParlamentar: readString(row['siglaUFParlamentar']),
    siglaVotoParlamentar: readString(row['siglaVotoParlamentar']),
  }
}

function toRawVotacao(value: unknown): SenadoRawVotacao | null {
  const row = readRecord(value)
  if (!row) return null
  const votos = Array.isArray(row['votos']) ? row['votos'] : []
  return {
    codigoSessaoVotacao: readNumber(row['codigoSessaoVotacao']),
    sequencialVotacao: readNumber(row['sequencialVotacao']),
    dataSessao: readString(row['dataSessao']),
    identificacao: readString(row['identificacao']),
    ementa: readString(row['ementa']),
    descricaoVotacao: readString(row['descricaoVotacao']),
    codigoMateria: readNumber(row['codigoMateria']),
    votacaoSecreta: readString(row['votacaoSecreta']),
    resultadoVotacao: readString(row['resultadoVotacao']),
    votos: votos.map(toRawVote).filter((vote): vote is SenadoRawVote => vote !== null),
  }
}

/** Votações nominais e secretas de um ano. A API limita o intervalo a 1 ano. */
export async function fetchVotacoesByYear(year: number): Promise<SenadoRawVotacao[]> {
  const cached = votacoesByYear.get(year)
  if (cached && cached.expiresAt > Date.now()) return cached.votacoes

  const payload = await requestJson(`/votacao?dataInicio=${year}-01-01&dataFim=${year}-12-31`, `votacoes ${year}`)
  if (!Array.isArray(payload)) throw new AppError(502, 'O Senado devolveu a lista de votações em formato inesperado', 'SOURCE_INVALID_RESPONSE')

  const votacoes = payload.map(toRawVotacao).filter((item): item is SenadoRawVotacao => item !== null)
  votacoesByYear.set(year, { expiresAt: Date.now() + CACHE_TTL_MS, votacoes })
  return votacoes
}

function toRawSenator(value: unknown): SenadoRawSenator | null {
  const row = readRecord(value)
  const identity = row ? readRecord(row['IdentificacaoParlamentar']) : null
  const code = identity ? readNumber(identity['CodigoParlamentar']) : null
  const name = identity ? readString(identity['NomeParlamentar']) : null
  if (code === null || name === null) return null

  const mandate = row ? readRecord(row['Mandato']) : null
  const firstLegislature = mandate ? readRecord(mandate['PrimeiraLegislaturaDoMandato']) : null
  // O mandato de senador dura 8 anos e atravessa DUAS legislaturas de 4. Quem foi eleito em
  // 2018 tem primeira=56 (2019-2023) e segunda=57 (2023-2027): o fim do mandato esta na
  // SEGUNDA. Ler o `DataFim` da primeira inverte o grupo — marca como "na urna" justamente
  // os 27 que seguem ate 2031.
  const secondLegislature = mandate ? readRecord(mandate['SegundaLegislaturaDoMandato']) : null

  return {
    code,
    name,
    party: readString(identity?.['SiglaPartidoParlamentar']),
    state: readString(identity?.['UfParlamentar']),
    photoUrl: toHttps(readString(identity?.['UrlFotoParlamentar'])),
    officialPageUrl: toHttps(readString(identity?.['UrlPaginaParlamentar'])),
    firstLegislature: firstLegislature ? readString(firstLegislature['NumeroLegislatura']) : null,
    mandateEndsAt: secondLegislature ? readString(secondLegislature['DataFim']) : null,
  }
}

/** Os 81 senadores em exercício, com o carimbo de versão que o próprio Senado publica. */
export async function fetchCurrentSenators(): Promise<{ senators: SenadoRawSenator[]; sourceVersion: string | null }> {
  if (senatorsCache && senatorsCache.expiresAt > Date.now()) {
    return { senators: senatorsCache.senators, sourceVersion: senatorsCache.sourceVersion }
  }

  const payload = await requestJson('/senador/lista/atual', 'senadores em exercicio')
  const root = readRecord(readRecord(payload)?.['ListaParlamentarEmExercicio'])
  const list = readRecord(root?.['Parlamentares'])?.['Parlamentar']
  if (!Array.isArray(list)) throw new AppError(502, 'O Senado devolveu a lista de senadores em formato inesperado', 'SOURCE_INVALID_RESPONSE')

  const senators = list.map(toRawSenator).filter((item): item is SenadoRawSenator => item !== null)
  const sourceVersion = readString(readRecord(root?.['Metadados'])?.['Versao'])

  senatorsCache = { expiresAt: Date.now() + CACHE_TTL_MS, senators, sourceVersion }
  return { senators, sourceVersion }
}

function toRawProcess(value: unknown): SenadoRawProcess | null {
  const row = readRecord(value)
  const identification = readString(row?.['identificacao'])
  const matterCode = readNumber(row?.['codigoMateria'])
  if (identification === null || matterCode === null) return null
  const processing = readString(row?.['tramitando'])
  return {
    identification,
    popularName: readString(row?.['apelido']),
    matterCode,
    presentedAt: readString(row?.['dataApresentacao']),
    status: readString(row?.['situacaoAtual']),
    statusAt: readString(row?.['dataSituacaoAtual']),
    sourceUpdatedAt: readString(row?.['dataUltimaAtualizacao']),
    processing: processing === null ? null : processing === 'Sim',
    objective: readString(row?.['objetivo']),
    documentUrl: toHttps(readString(row?.['urlDocumento'])),
  }
}

/** Uma matéria específica na tramitação do Senado; o filtro `numero` evita baixar o ano. */
export async function fetchSenadoProcess(sigla: string, number: number, year: number): Promise<SenadoRawProcess | null> {
  const key = `${sigla}-${number}-${year}`
  const cached = processCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.process

  const query = new URLSearchParams({ sigla, numero: String(number), ano: String(year) })
  const payload = await requestJson(`/processo?${query.toString()}`, `tramitação de ${sigla} ${number}/${year}`)
  if (!Array.isArray(payload)) throw new AppError(502, 'O Senado devolveu a tramitação em formato inesperado', 'SOURCE_INVALID_RESPONSE')

  const identification = `${sigla} ${number}/${year}`
  const process = payload.map(toRawProcess).find((item) => item?.identification === identification) ?? null
  processCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, process })
  return process
}

/**
 * Primeiro ano do recorte que a 10xGov consome. Duas razoes medidas:
 *
 * 1. Os 54 senadores que estao na urna em out/2026 tomaram posse em 01/02/2019 — o
 *    retrospecto precisa cobrir o mandato que o eleitor esta julgando.
 * 2. 2015 e 2016 estao corrompidos na fonte (votacoes dos anos 90 com `dataSessao` errada).
 *    Comecar em 2019 mantem a janela inteira fora do lixo.
 */
export const RECORD_FROM_YEAR = 2019

export function currentYear(): number {
  return new Date().getUTCFullYear()
}

/**
 * Votacoes NOMINais do recorte, de `RECORD_FROM_YEAR` ate hoje.
 *
 * So nominais: em votacao secreta a API devolve `Votou` no lugar do voto, sem conteudo — nao
 * da para dizer como ninguem votou. Compartilhado por `SenatorModel` e `VotacaoModel`, que
 * sao duas leituras do mesmo conjunto.
 */
export async function fetchNominalVotacoes(): Promise<SenadoRawVotacao[]> {
  const years: number[] = []
  for (let year = RECORD_FROM_YEAR; year <= currentYear(); year += 1) years.push(year)

  const batches = await Promise.all(years.map((year) => fetchVotacoesByYear(year)))
  return batches.flat().filter(isNominalVotacao)
}

/**
 * `N` no `votacaoSecreta` e a unica condicao para existir voto individual.
 *
 * Em votacao secreta a API preenche `votos[]` com 81 linhas de `Votou`/`NCom` — parece dado,
 * mas nao diz como ninguem votou. Sao 34,7% de toda a base; deixar entrar transformaria o
 * retrospecto em ruido.
 */
export function isNominalVotacao(votacao: SenadoRawVotacao): boolean {
  return votacao.votacaoSecreta === 'N'
}

/** Usado nos testes para isolar um caso do anterior. */
export function clearSenadoCache(): void {
  votacoesByYear.clear()
  senatorsCache = null
  processCache.clear()
}
