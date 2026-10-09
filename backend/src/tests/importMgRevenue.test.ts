import { gzipSync, gunzipSync } from 'node:zlib'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { importOfficialData } from '@/services/importOfficialData'
import { mgRevenueAdapter } from '@/adapters/mgRevenue'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { officialHttpGet } from '@/utils/officialHttpGet'
import { REVENUE_FIELDS } from '@/adapters/mgRevenueValidation'
import { sha256 } from '@/utils/officialData'

jest.mock('@/models/OfficialDataModel')
jest.mock('@/utils/officialHttpGet')
const model = jest.mocked(OfficialDataModel)
const http = jest.mocked(officialHttpGet)
const base = 'https://dados.mg.gov.br/files/'
const definition = { resources: [
  { name: 'dm_tempo_mensal', title: 'Mês', schema: { fields: [{ name: 'id_tempo' }, { name: 'ano' }], primaryKey: ['id_tempo'] } },
  { name: 'ft_receita_v2018', title: 'Receita', schema: { fields: REVENUE_FIELDS.map((name) => ({ name })), foreignKeys: [{ fields: ['id_tempo'], reference: { fields: ['id_tempo'], resource: 'dm_tempo_mensal' } }] } },
] }
const ckan = { success: true, result: { id: 'package-id', metadata_modified: '2026-10-08', resources: [{ id: 'schema', name: 'schema', url: `${base}datapackage.json` }, { id: 'month', name: 'month', url: `${base}dm_tempo_mensal.csv.gz` }, { id: 'fact', name: 'fact', url: `${base}ft_receita_v2018.csv.gz` }] } }
let emptyFact = false
beforeEach(() => {
  jest.resetAllMocks(); emptyFact = false
  model.saveResource.mockImplementation(async (input) => ({ ...input, id: input.name, active_snapshot_id: null }))
  model.beginSnapshot.mockImplementation(async (input) => ({ id: input.resource.name, reused: false }))
  model.publishSnapshot.mockImplementation(async (id) => id)
  http.mockImplementation(async (url) => {
    let body: Buffer
    if (url.includes('package_show')) body = Buffer.from(JSON.stringify(ckan))
    else if (url.endsWith('datapackage.json')) body = Buffer.from(JSON.stringify(definition))
    else if (url.endsWith('dm_tempo_mensal.csv.gz')) body = gzipSync(Buffer.from('id_tempo;ano\n1;2025\n'))
    else body = gzipSync(Buffer.from(`${REVENUE_FIELDS.join(';')}\n${emptyFact ? '' : '1;2;3;4;5;6;7;8;9;10;11;01;001234;2025;-0.01\n'}`))
    return { status: 200, headers: {}, body }
  })
})
describe('importMgRevenue', () => {
  it('retoma documentos pendentes sem reconsultar os prontos nem falsificar a data de verificação', async () => {
    const source = { id: 'resume-example', title: 'Fonte', organization: 'Órgão', jurisdiction_code: 'BR', official_url: 'https://official.example', metadata: {} }
    const document = { name: 'dictionary', title: 'Dicionário', official_id: null, url: 'https://official.example/dictionary.json', format: 'JSON', kind: 'document' as const, schema: {}, parserVersion: 'v1', dependencies: [] }
    model.listResources.mockResolvedValue({ items: [{ ...document, id: 'dictionary-id', source_id: source.id, active_snapshot_id: 'ready-dictionary', last_check: { result: 'access_tested', checkedAt: 'previous-date' }, latestAttempt: null, snapshot: null }], total: 1, page: 1, pageSize: 100 })
    await importOfficialData({ id: source.id, allowedHosts: ['official.example'], discover: async () => ({ source, resources: [document, { ...document, name: 'new-file', url: 'https://official.example/new.json', dependencies: ['dictionary'], collected: { body: Buffer.from('{}'), fetchedAt: '2026-10-08T10:00:00Z' } }] }) }, () => {}, { skipReadyDocuments: true })
    expect(http).not.toHaveBeenCalled()
    expect(model.recordCheck.mock.calls.some(([id]) => id === 'dictionary-id')).toBe(false)
    expect(model.beginSnapshot).toHaveBeenCalledWith(expect.objectContaining({ dependencies: { dictionary: 'ready-dictionary' } }))
  })
  it('preserva bytes maiores com gzip reversível e distingue catálogo identificado de arquivo consultado', async () => {
    const body = Buffer.from(JSON.stringify({ dados: [{ name: 'A'.repeat(7 * 1024 * 1024) }] }))
    const file = { name: 'large-file', title: 'Arquivo', official_id: null, url: 'https://official.example/data.json', format: 'JSON', kind: 'document' as const, schema: { purpose: 'raw' }, parserVersion: 'archive-v1', dependencies: [], storageEncoding: 'gzip' as const, collected: { body, fetchedAt: '2026-10-08T10:00:00Z' }, parse: () => [] }
    await importOfficialData({ id: 'large-example', allowedHosts: ['official.example'], discover: async () => ({ source: { id: 'large-example', title: 'Fonte', organization: 'Órgão', jurisdiction_code: 'BR', official_url: 'https://official.example', metadata: {} }, catalog: [file], resources: [file] }) }, () => {})
    expect(model.registerDiscoveredResources).toHaveBeenCalledWith([expect.objectContaining({ last_check: expect.objectContaining({ result: 'identified' }) })])
    const saved = model.beginSnapshot.mock.calls[0]![0]
    expect(saved.resource.format).toBe('JSON_GZIP')
    expect(saved.body.length).toBeLessThan(6 * 1024 * 1024)
    expect(sha256(gunzipSync(saved.body))).toBe(sha256(body))
    expect(model.publishSnapshot).toHaveBeenCalledWith('large-file', expect.objectContaining({ verification: expect.objectContaining({ storageEncoding: 'gzip', originalSha256: sha256(body), originalByteSize: body.length }) }))
    expect(model.writeRows).not.toHaveBeenCalled()
  })
  it('preserva originais, valida e publica o fato com dependências fixadas', async () => {
    await importOfficialData(mgRevenueAdapter, () => {})
    expect(model.beginSnapshot).toHaveBeenCalledTimes(4)
    expect(model.writeRows).toHaveBeenCalledWith('ft_receita_v2018', [expect.objectContaining({ payload: expect.objectContaining({ vr_efetivado: '-0.01' }) })])
    expect(model.publishSnapshot).toHaveBeenLastCalledWith('ft_receita_v2018', expect.objectContaining({ rowCount: 1, dependencies: { 'ckan-metadata': 'ckan-metadata', datapackage: 'datapackage', dm_tempo_mensal: 'dm_tempo_mensal' }, verification: expect.objectContaining({ dimensionLinksValidated: true }) }))
  })
  it('registra falha sem publicar fato vazio nem trocar sua versão ativa', async () => {
    emptyFact = true
    await expect(importOfficialData(mgRevenueAdapter, () => {})).rejects.toThrow('sem registros')
    expect(model.failSnapshot).toHaveBeenCalledWith('ft_receita_v2018', expect.any(Error))
    expect(model.publishSnapshot.mock.calls.some(([id]) => id === 'ft_receita_v2018')).toBe(false)
  })
  it.each(['snapshot', 'verification'])('preserva a causa quando registrar a falha de %s também falha', async (stage) => {
    emptyFact = true
    const recordError = new Error('Registro de falha indisponível')
    if (stage === 'snapshot') model.failSnapshot.mockRejectedValue(recordError)
    else model.recordCheck.mockImplementation(async (_id, check) => { if (check['result'] === 'failed') throw recordError })
    await expect(importOfficialData(mgRevenueAdapter, () => {})).rejects.toMatchObject({ cause: recordError, errors: [expect.objectContaining({ message: expect.stringContaining('sem registros') }), recordError] })
  })
  it('reexecução de conteúdo já validado não insere registros novamente', async () => {
    model.beginSnapshot.mockImplementation(async (input) => ({ id: input.resource.name, reused: true }))
    await importOfficialData(mgRevenueAdapter, () => {})
    expect(model.writeRows).not.toHaveBeenCalled()
    expect(model.publishSnapshot).not.toHaveBeenCalled()
  })
  it('o mesmo pipeline importa outra fonte, jurisdição, período e schema', async () => {
    const collected = { body: Buffer.from('[{"quantity":"0042"}]'), fetchedAt: '2026-10-08T10:00:00Z' }
    await importOfficialData({ id: 'municipal-example', allowedHosts: ['official.example'], discover: async () => ({
      source: { id: 'municipal-example', title: 'Indicador municipal', organization: 'Órgão de teste', jurisdiction_code: '9999999', official_url: 'https://official.example', metadata: { unit: 'people' } },
      resources: [{ name: 'annual-data', title: 'Série', official_id: null, url: 'https://official.example/data.json', format: 'JSON', kind: 'table', schema: { fields: [{ name: 'quantity', type: 'integer' }] }, parserVersion: 'example-v1', dependencies: [], collected, parse: () => [{ row_number: 1, reference_year: 1999, record_key: 'municipal-1999', payload: { quantity: '0042' } }] }],
    }) }, () => {})
    expect(model.saveSource).toHaveBeenCalledWith(expect.objectContaining({ id: 'municipal-example', jurisdiction_code: '9999999' }))
    expect(model.writeRows).toHaveBeenCalledWith('annual-data', [expect.objectContaining({ reference_year: 1999, payload: { quantity: '0042' } })])
    expect(http).not.toHaveBeenCalled()
  })
  it('preserva registros com relações explicitamente pendentes quando uma dimensão opcional falha', async () => {
    model.writeRows.mockImplementation(async (id) => { if (id === 'dm_tempo_mensal') throw new Error('Dimensão indisponível') })
    await importOfficialData(mgRevenueAdapter, () => {})
    expect(model.failSnapshot).toHaveBeenCalledWith('dm_tempo_mensal', expect.any(Error))
    expect(model.publishSnapshot).toHaveBeenLastCalledWith('ft_receita_v2018', expect.objectContaining({ verification: expect.objectContaining({ dimensionLinksValidated: false, dimensionLinks: [expect.objectContaining({ status: 'pending' })] }) }))
  })
  it('registra falha HTTP sem inventar snapshot e conserva as consultas independentes', async () => {
    const implementation = http.getMockImplementation()!
    http.mockImplementation(async (url, options) => url.endsWith('dm_tempo_mensal.csv.gz') ? { status: 503, headers: {}, body: Buffer.from('indisponível') } : implementation(url, options))
    await importOfficialData(mgRevenueAdapter, () => {})
    expect(model.recordCheck).toHaveBeenCalledWith('dm_tempo_mensal', expect.objectContaining({ httpStatus: 503, result: 'failed' }))
    expect(model.beginSnapshot.mock.calls.some(([input]) => input.resource.name === 'dm_tempo_mensal')).toBe(false)
    expect(model.publishSnapshot).toHaveBeenLastCalledWith('ft_receita_v2018', expect.objectContaining({ verification: expect.objectContaining({ dimensionLinksValidated: false }) }))
  })
})
