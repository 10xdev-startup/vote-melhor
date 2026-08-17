import { AppError } from '@/utils/AppError'
import { tallyCamaraVotes } from '@/utils/normalizeCamaraVote'
import type { CamaraRawAffectedProposition, CamaraRawDeputy, CamaraRawProposition, CamaraRawVote, CamaraRawVoting, CamaraVotingDataset } from '@/types/camara'

const API_BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2'
const FILE_BASE_URL = 'https://dadosabertos.camara.leg.br/arquivos'
const SOURCE_TIMEOUT_MS = 120_000
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024
/** Os arquivos são atualizados diariamente; seis horas evitam releituras sem esconder dias. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_DEPUTY_PAGES = 20

export const CAMARA_RECORD_YEAR = 2026
export const CAMARA_SOURCE_URLS = [
  `${API_BASE_URL}/deputados`,
  `${FILE_BASE_URL}/votacoes/json/votacoes-${CAMARA_RECORD_YEAR}.json`,
  `${FILE_BASE_URL}/votacoesVotos/json/votacoesVotos-${CAMARA_RECORD_YEAR}.json`,
  `${FILE_BASE_URL}/votacoesProposicoes/json/votacoesProposicoes-${CAMARA_RECORD_YEAR}.json`,
]

interface JsonResult {
  payload: unknown
  lastModified: string | null
}

interface CachedDataset {
  expiresAt: number
  dataset: CamaraVotingDataset
}

let datasetCache: CachedDataset | null = null

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readVoteCode(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readBooleanFlag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  return null
}

async function requestJson(url: string, context: string): Promise<JsonResult> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': '10xGov/1.0 (+https://github.com/10xdev/10x-gov)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AppError(504, 'A Câmara não respondeu a tempo', 'SOURCE_TIMEOUT')
    }
    const cause = error instanceof Error ? (error.cause ?? error.message) : error
    console.error('[camara] falha ao consultar a origem', { url, context, cause })
    throw new AppError(502, 'A fonte da Câmara não respondeu', 'SOURCE_UNAVAILABLE')
  }

  if (!response.ok) throw new AppError(502, `A Câmara respondeu ${response.status}`, 'SOURCE_UNAVAILABLE')

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new AppError(502, 'A resposta da Câmara excedeu o limite de segurança', 'SOURCE_TOO_LARGE')
  }

  const body = await response.text()
  if (body.trim().length === 0) throw new AppError(502, 'A Câmara devolveu uma resposta vazia', 'SOURCE_EMPTY_RESPONSE')

  try {
    return { payload: JSON.parse(body) as unknown, lastModified: readString(response.headers.get('last-modified')) }
  } catch {
    throw new AppError(502, 'A Câmara devolveu um JSON inválido', 'SOURCE_INVALID_RESPONSE')
  }
}

function readDataList(payload: unknown, context: string): unknown[] {
  const data = readRecord(payload)?.['dados']
  if (!Array.isArray(data)) throw new AppError(502, `A Câmara devolveu ${context} em formato inesperado`, 'SOURCE_INVALID_RESPONSE')
  return data
}

function toRawDeputy(value: unknown): CamaraRawDeputy | null {
  const row = readRecord(value)
  const id = readNumber(row?.['id'])
  const name = readString(row?.['nome'])
  if (id === null || name === null) return null
  return {
    id,
    name,
    party: readString(row?.['siglaPartido']),
    state: readString(row?.['siglaUf']),
    photoUrl: readString(row?.['urlFoto']),
    apiUrl: readString(row?.['uri']),
    officialPageUrl: `https://www.camara.leg.br/deputados/${id}`,
  }
}

function toRawVoting(value: unknown): CamaraRawVoting | null {
  const row = readRecord(value)
  const id = readString(row?.['id'])
  if (id === null) return null
  return {
    id,
    apiUrl: readString(row?.['uri']),
    date: readString(row?.['data']),
    organ: readString(row?.['siglaOrgao']),
    approval: readBooleanFlag(row?.['aprovacao']),
    yes: readNumber(row?.['votosSim']) ?? 0,
    no: readNumber(row?.['votosNao']) ?? 0,
    other: readNumber(row?.['votosOutros']) ?? 0,
    description: readString(row?.['descricao']),
  }
}

function toRawVote(value: unknown): CamaraRawVote | null {
  const row = readRecord(value)
  const deputy = readRecord(row?.['deputado_'])
  const votingId = readString(row?.['idVotacao'])
  const officialCode = readVoteCode(row?.['voto'])
  if (votingId === null || officialCode === null) return null
  return {
    votingId,
    recordedAt: readString(row?.['dataHoraVoto']),
    officialCode,
    deputyId: readNumber(deputy?.['id']),
    deputyName: readString(deputy?.['nome']),
    partyAtTime: readString(deputy?.['siglaPartido']),
    state: readString(deputy?.['siglaUf']),
  }
}

function toRawProposition(value: unknown): CamaraRawProposition | null {
  const row = readRecord(value)
  const id = readNumber(row?.['id'])
  if (id === null) return null
  return {
    id,
    title: readString(row?.['titulo']),
    summary: readString(row?.['ementa']),
    apiUrl: readString(row?.['uri']),
    officialPageUrl: `https://www.camara.leg.br/propostas-legislativas/${id}`,
  }
}

function toRawAffectedProposition(value: unknown): CamaraRawAffectedProposition | null {
  const row = readRecord(value)
  const votingId = readString(row?.['idVotacao'])
  const proposition = toRawProposition(row?.['proposicao_'])
  return votingId && proposition ? { votingId, proposition } : null
}

function nextLink(payload: unknown): string | null {
  const links = readRecord(payload)?.['links']
  if (!Array.isArray(links)) return null
  for (const value of links) {
    const link = readRecord(value)
    if (readString(link?.['rel']) === 'next') return readString(link?.['href'])
  }
  return null
}

async function fetchCurrentDeputies(): Promise<CamaraRawDeputy[]> {
  const deputies: CamaraRawDeputy[] = []
  const visited = new Set<string>()
  let url: string | null = `${API_BASE_URL}/deputados?itens=100&ordem=ASC&ordenarPor=nome`

  while (url) {
    if (visited.has(url) || visited.size >= MAX_DEPUTY_PAGES) {
      throw new AppError(502, 'A paginação de deputados da Câmara não terminou', 'SOURCE_INVALID_RESPONSE')
    }
    visited.add(url)
    const { payload } = await requestJson(url, 'deputados em exercício')
    deputies.push(...readDataList(payload, 'a lista de deputados').map(toRawDeputy).filter((item): item is CamaraRawDeputy => item !== null))
    url = nextLink(payload)
  }

  return deputies
}

export function isPublicNominalVoting(voting: CamaraRawVoting, votes: readonly CamaraRawVote[]): boolean {
  return voting.organ === 'PLEN' && votes.length > 0 && votes.every((vote) => vote.officialCode !== '')
}

function latestSourceDate(values: Array<string | null>): string | null {
  const dates = values
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
  return dates[0]?.toISOString() ?? null
}

function validateTallies(votings: readonly CamaraRawVoting[], votes: readonly CamaraRawVote[]): void {
  const codesByVoting = new Map<string, string[]>()
  for (const vote of votes) {
    const codes = codesByVoting.get(vote.votingId)
    if (codes) codes.push(vote.officialCode)
    else codesByVoting.set(vote.votingId, [vote.officialCode])
  }

  for (const voting of votings) {
    const tally = tallyCamaraVotes(codesByVoting.get(voting.id) ?? [])
    const countedOther = tally.abstention + tally.obstruction + tally.notEligible + tally.unclassified
    if (voting.yes !== tally.yes || voting.no !== tally.no || voting.other !== countedOther) {
      throw new AppError(502, `O placar da votação ${voting.id} diverge dos votos publicados`, 'SOURCE_INCONSISTENT')
    }
  }
}

export async function fetchCamaraVotingDataset(): Promise<CamaraVotingDataset> {
  if (datasetCache && datasetCache.expiresAt > Date.now()) return datasetCache.dataset

  const [deputies, votingsResult, votesResult, propositionsResult] = await Promise.all([
    fetchCurrentDeputies(),
    requestJson(CAMARA_SOURCE_URLS[1] ?? '', 'votações de 2026'),
    requestJson(CAMARA_SOURCE_URLS[2] ?? '', 'votos de 2026'),
    requestJson(CAMARA_SOURCE_URLS[3] ?? '', 'proposições afetadas em 2026'),
  ])

  const allVotings = readDataList(votingsResult.payload, 'as votações').map(toRawVoting).filter((item): item is CamaraRawVoting => item !== null)
  const allVotes = readDataList(votesResult.payload, 'os votos').map(toRawVote).filter((item): item is CamaraRawVote => item !== null)
  const allAffected = readDataList(propositionsResult.payload, 'as proposições afetadas').map(toRawAffectedProposition).filter((item): item is CamaraRawAffectedProposition => item !== null)

  const votesByVoting = new Map<string, CamaraRawVote[]>()
  for (const vote of allVotes) {
    const rows = votesByVoting.get(vote.votingId)
    if (rows) rows.push(vote)
    else votesByVoting.set(vote.votingId, [vote])
  }

  const votings = allVotings.filter((voting) => isPublicNominalVoting(voting, votesByVoting.get(voting.id) ?? []))
  const votingIds = new Set(votings.map((voting) => voting.id))
  const votes = allVotes.filter((vote) => votingIds.has(vote.votingId))
  const affectedPropositions = allAffected.filter((item) => votingIds.has(item.votingId))
  validateTallies(votings, votes)

  const dataset: CamaraVotingDataset = {
    deputies,
    votings,
    votes,
    affectedPropositions,
    sourceUpdatedAt: latestSourceDate([votingsResult.lastModified, votesResult.lastModified, propositionsResult.lastModified]),
  }
  datasetCache = { expiresAt: Date.now() + CACHE_TTL_MS, dataset }
  return dataset
}

export function clearCamaraCache(): void {
  datasetCache = null
}

