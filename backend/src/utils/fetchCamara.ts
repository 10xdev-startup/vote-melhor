import { AppError } from '@/utils/AppError'
import { tallyCamaraVotes } from '@/utils/normalizeCamaraVote'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { parseArchiveCsv } from '@/utils/parseArchiveCsv'
import { CAMARA_CURRENT_DEPUTIES_URL, camaraDeputyPageName } from '@/utils/legislativeArchiveRequests'
import type { CamaraRawAffectedProposition, CamaraRawDeputy, CamaraRawProposition, CamaraRawVote, CamaraRawVoting, CamaraVotingDataset } from '@/types/camara'

const API_BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2'
const FILE_BASE_URL = 'https://dadosabertos.camara.leg.br/arquivos'
/** Cache de leitura do acervo; a atualização pertence à importação administrativa. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_DEPUTY_PAGES = 20

export const CAMARA_RECORD_YEAR = 2026
export const CAMARA_SOURCE_URLS = [
  `${API_BASE_URL}/deputados`,
  `${FILE_BASE_URL}/votacoes/json/votacoes-${CAMARA_RECORD_YEAR}.json`,
  `${FILE_BASE_URL}/votacoesVotos/csv/votacoesVotos-${CAMARA_RECORD_YEAR}.csv`,
  `${FILE_BASE_URL}/votacoesProposicoes/json/votacoesProposicoes-${CAMARA_RECORD_YEAR}.json`,
]

interface JsonResult {
  payload: unknown
  fetchedAt: string
  dependencies: Record<string, string>
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

async function requestJson(url: string, context: string, snapshotId?: string): Promise<JsonResult> {
  const archive = await OfficialDataModel.readArchive(url, snapshotId)
  if (archive.format !== 'JSON') throw new AppError(502, `Arquivo de ${context} não é JSON`, 'SOURCE_INVALID_RESPONSE')
  try {
    return { payload: JSON.parse(archive.body.toString('utf8')) as unknown, fetchedAt: archive.fetchedAt, dependencies: archive.dependencies }
  } catch {
    throw new AppError(502, 'O arquivo preservado da Câmara contém JSON inválido', 'SOURCE_INVALID_RESPONSE')
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
    deputyId: readNumber(deputy?.['id'] ?? row?.['deputado_id']),
    deputyName: readString(deputy?.['nome'] ?? row?.['deputado_nome']),
    partyAtTime: readString(deputy?.['siglaPartido'] ?? row?.['deputado_siglaPartido']),
    state: readString(deputy?.['siglaUf'] ?? row?.['deputado_siglaUf']),
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

async function fetchCurrentDeputies(): Promise<{ deputies: CamaraRawDeputy[]; fetchedAt: string }> {
  const deputies: CamaraRawDeputy[] = []
  const visited = new Set<string>()
  let url: string | null = CAMARA_CURRENT_DEPUTIES_URL
  let dependencies: Record<string, string> = {}; let fetchedAt = ''; let snapshotId: string | undefined

  while (url) {
    if (visited.has(url) || visited.size >= MAX_DEPUTY_PAGES) {
      throw new AppError(502, 'A paginação de deputados da Câmara não terminou', 'SOURCE_INVALID_RESPONSE')
    }
    visited.add(url)
    const result = await requestJson(url, 'deputados em exercício', snapshotId)
    if (visited.size === 1) { dependencies = result.dependencies; fetchedAt = result.fetchedAt }
    const payload = result.payload
    const rows = readDataList(payload, 'a lista de deputados').map(toRawDeputy)
    if (!rows.length || rows.some((row) => row === null)) throw new AppError(502, 'Cadastro preservado de deputados incompleto', 'SOURCE_INVALID_RESPONSE')
    deputies.push(...rows.filter((item): item is CamaraRawDeputy => item !== null))
    url = nextLink(payload)
    if (url) {
      snapshotId = dependencies[camaraDeputyPageName(visited.size + 1)]
      if (!snapshotId) throw new AppError(503, 'Página de deputados não pertence à coleta preservada', 'ARCHIVE_RESOURCE_NOT_READY')
    }
  }

  if (new Set(deputies.map((deputy) => deputy.id)).size !== deputies.length) throw new AppError(502, 'Cadastro preservado contém deputados duplicados', 'SOURCE_INVALID_RESPONSE')
  return { deputies, fetchedAt }
}

export function isPublicNominalVoting(voting: CamaraRawVoting, votes: readonly CamaraRawVote[]): boolean {
  return voting.organ === 'PLEN' && votes.length > 0 && votes.every((vote) => vote.officialCode !== '')
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

  const [deputiesResult, votingsResult, votesResult, propositionsResult] = await Promise.all([
    fetchCurrentDeputies(),
    requestJson(CAMARA_SOURCE_URLS[1] ?? '', 'votações de 2026'),
    OfficialDataModel.readArchive(CAMARA_SOURCE_URLS[2] ?? ''),
    requestJson(CAMARA_SOURCE_URLS[3] ?? '', 'proposições afetadas em 2026'),
  ])

  const allVotings = readDataList(votingsResult.payload, 'as votações').map(toRawVoting).filter((item): item is CamaraRawVoting => item !== null)
  if (votesResult.format !== 'CSV') throw new AppError(502, 'Arquivo preservado de votos não é CSV', 'SOURCE_INVALID_RESPONSE')
  let allVotes: CamaraRawVote[]
  try { allVotes = Array.from(parseArchiveCsv(votesResult.body), (row) => {
    const vote = toRawVote(row)
    if (!vote) throw new Error('Registro de voto sem identificador ou código')
    return vote
  }) }
  catch { throw new AppError(502, 'O arquivo preservado de votos contém CSV inválido', 'SOURCE_INVALID_RESPONSE') }
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
    deputies: deputiesResult.deputies,
    votings,
    votes,
    affectedPropositions,
    sourceUpdatedAt: null,
    collectedAt: [deputiesResult.fetchedAt, votingsResult.fetchedAt, votesResult.fetchedAt, propositionsResult.fetchedAt].sort()[0]!,
  }
  datasetCache = { expiresAt: Date.now() + CACHE_TTL_MS, dataset }
  return dataset
}

export function clearCamaraCache(): void {
  datasetCache = null
}

