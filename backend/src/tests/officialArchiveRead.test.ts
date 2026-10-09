import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { gzipSync } from 'node:zlib'
import { supabase } from '@/database/supabase'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { sha256 } from '@/utils/officialData'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() } } }))
const raw = Buffer.from('{"id":"001","amount":"9007199254740993.01"}')
const stored = gzipSync(raw)
const snapshot = { id: 'snapshot-ready', source_url: 'https://official.example/data.json', fetched_at: '2026-10-08T20:00:00.000Z', dependencies: { page2: 'version-page2' }, verification: { storageEncoding: 'gzip', originalFormat: 'JSON', originalSha256: sha256(raw), originalByteSize: raw.length }, storage_path: 'source/hash/original.json.gz', storage_bucket: 'official-data', sha256: sha256(stored) }
const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn<() => Promise<{ data: typeof snapshot | null; error: Error | null }>>() }
const resourceQuery = { select: jest.fn(), eq: jest.fn(), not: jest.fn(), limit: jest.fn<() => Promise<{ data: { active_snapshot_id: string }[] | null; error: Error | null }>>() }
const download = jest.fn<() => Promise<{ data: { arrayBuffer: () => Promise<ArrayBuffer> } | null; error: Error | null }>>()
beforeEach(() => {
  jest.resetAllMocks()
  for (const method of [query.select, query.eq, query.order, query.limit]) method.mockReturnValue(query)
  for (const method of [resourceQuery.select, resourceQuery.eq, resourceQuery.not]) method.mockReturnValue(resourceQuery)
  resourceQuery.limit.mockResolvedValue({ data: [{ active_snapshot_id: snapshot.id }], error: null })
  jest.mocked(supabase.from).mockImplementation((table) => (table === 'public_data_resources' ? resourceQuery : query) as unknown as ReturnType<typeof supabase.from>)
  jest.mocked(supabase.storage.from).mockReturnValue({ download } as unknown as ReturnType<typeof supabase.storage.from>)
  query.maybeSingle.mockResolvedValue({ data: snapshot, error: null })
  download.mockResolvedValue({ data: { arrayBuffer: async () => Uint8Array.from(stored).buffer }, error: null })
})
describe('leitura genérica de arquivos preservados', () => {
  it('confere os dois hashes e devolve bytes e procedência da versão pronta', async () => {
    const result = await OfficialDataModel.readArchive(snapshot.source_url)
    expect(result.body.toString()).toBe(raw.toString())
    expect(result).toMatchObject({ snapshotId: snapshot.id, fetchedAt: snapshot.fetched_at, format: 'JSON', dependencies: snapshot.dependencies })
    expect(query.eq).toHaveBeenCalledWith('source_url', snapshot.source_url)
    expect(query.eq).toHaveBeenCalledWith('state', 'ready')
    expect(query.eq).toHaveBeenCalledWith('id', snapshot.id)
    expect(resourceQuery.eq).toHaveBeenCalledWith('url', snapshot.source_url)
    expect(query.order).toHaveBeenCalledWith('fetched_at', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1)
  })
  it('vincula a página à versão solicitada sem retirar o filtro de URL e estado', async () => {
    await OfficialDataModel.readArchive(snapshot.source_url, 'pinned-snapshot')
    expect(query.eq).toHaveBeenCalledWith('id', 'pinned-snapshot')
    expect(query.eq).toHaveBeenCalledWith('source_url', snapshot.source_url)
    expect(query.eq).toHaveBeenCalledWith('state', 'ready')
  })
  it('distingue arquivo ainda não coletado de resposta vazia', async () => {
    resourceQuery.limit.mockResolvedValue({ data: [], error: null })
    await expect(OfficialDataModel.readArchive(snapshot.source_url)).rejects.toMatchObject({ status: 503, code: 'ARCHIVE_RESOURCE_NOT_READY' })
    expect(download).not.toHaveBeenCalled()
  })
  it('propaga erros de banco e de Storage', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('Banco indisponível') })
    await expect(OfficialDataModel.readArchive(snapshot.source_url)).rejects.toThrow('Banco indisponível')
    download.mockResolvedValueOnce({ data: null, error: new Error('Storage indisponível') })
    await expect(OfficialDataModel.readArchive(snapshot.source_url)).rejects.toThrow('Storage indisponível')
  })
  it.each(['stored', 'decoded'])('recusa corrupção do conteúdo %s', async (level) => {
    query.maybeSingle.mockResolvedValue({ data: level === 'stored' ? { ...snapshot, sha256: 'wrong' } : { ...snapshot, verification: { ...snapshot.verification, originalSha256: 'wrong' } }, error: null })
    await expect(OfficialDataModel.readArchive(snapshot.source_url)).rejects.toMatchObject({ code: 'ARCHIVE_HASH_MISMATCH' })
  })
})

describe('seleção da versão ativa', () => {
  it('respeita o ponteiro do recurso, inclusive depois de um rollback lógico', async () => {
    resourceQuery.limit.mockResolvedValue({ data: [{ active_snapshot_id: 'older-active-snapshot' }], error: null })
    await OfficialDataModel.readArchive(snapshot.source_url)
    expect(query.eq).toHaveBeenCalledWith('id', 'older-active-snapshot')
  })
  it('recusa ambiguidade em vez de escolher uma fonte silenciosamente', async () => {
    resourceQuery.limit.mockResolvedValue({ data: [{ active_snapshot_id: 'first' }, { active_snapshot_id: 'second' }], error: null })
    await expect(OfficialDataModel.readArchive(snapshot.source_url)).rejects.toMatchObject({ code: 'ARCHIVE_RESOURCE_AMBIGUOUS' })
    expect(download).not.toHaveBeenCalled()
  })
})
