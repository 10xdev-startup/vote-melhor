import express from 'express'
import type { Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { dataCatalogRoutes } from '@/routes/dataCatalogRoutes'
import { errorHandler } from '@/middleware/errorHandler'
import { OfficialDataModel, type PublicResource } from '@/models/OfficialDataModel'
import { officialHttpGet } from '@/utils/officialHttpGet'

jest.mock('@/models/OfficialDataModel')
jest.mock('@/utils/officialHttpGet')
const model = jest.mocked(OfficialDataModel)
const resource: PublicResource = { id: 'internal-id', source_id: 'mg-revenue', name: 'ft_receita_v2018', title: 'Receita v2', official_id: null, url: 'https://dados.mg.gov.br/receita', format: 'CSV_GZIP', kind: 'table', active_snapshot_id: 'snapshot-id' }
let server: Server
let base: string
beforeAll(async () => {
  const app = express()
  app.use('/data-sources', dataCatalogRoutes)
  app.use(errorHandler)
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível')
  base = `http://127.0.0.1:${address.port}/data-sources/persisted/mg-revenue/resources/ft_receita_v2018`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })
beforeEach(() => { jest.clearAllMocks(); model.getReadyResource.mockResolvedValue(resource) })
describe('consulta de receita persistida', () => {
  it('pagina no banco e preserva decimal no envelope sem chamar origem oficial', async () => {
    model.recordsPage.mockResolvedValue({ snapshotId: 'snapshot-id', page: 2, pageSize: 2, total: 5, rows: [{ amount: '9007199254740993.01' }] })
    const response = await fetch(`${base}/preview?year=2025&page=2&limit=2`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, data: { snapshotId: 'snapshot-id', rows: [{ amount: '9007199254740993.01' }] } })
    expect(model.recordsPage).toHaveBeenCalledWith(resource, 2025, 2, 2)
    expect(officialHttpGet).not.toHaveBeenCalled()
    expect(model.beginSnapshot).not.toHaveBeenCalled()
  })
  it.each(['limit=201', 'limit=0', 'page=1.5', 'year=10000', 'page=1000001'])('recusa consulta inválida %s antes do banco', async (query) => {
    const response = await fetch(`${base}/preview?${query}`)
    expect(response.status).toBe(400)
    expect(model.getReadyResource).not.toHaveBeenCalled()
  })
  it('serve somente URL temporária gerada para o recurso do catálogo', async () => {
    model.originalUrl.mockResolvedValue({ url: 'https://storage.example/signed', expiresIn: 60, sha256: 'hash' })
    const response = await fetch(`${base}/original`)
    expect(response.status).toBe(200)
    expect(model.originalUrl).toHaveBeenCalledWith(resource)
    expect(officialHttpGet).not.toHaveBeenCalled()
  })
  it('preserva a caixa dos identificadores oficiais da Câmara ao abrir o original', async () => {
    model.originalUrl.mockResolvedValue({ url: 'https://storage.example/signed', expiresIn: 60, sha256: 'hash', storageEncoding: 'gzip', originalFormat: 'JSON' })
    const response = await fetch(base.replace('/mg-revenue/resources/ft_receita_v2018', '/camara-published-files/resources/eventosOrgaos-2026') + '/original')
    expect(response.status).toBe(200)
    expect(model.getReadyResource).toHaveBeenCalledWith('camara-published-files', 'eventosOrgaos-2026')
    expect(await response.json()).toMatchObject({ success: true, data: { storageEncoding: 'gzip', originalFormat: 'JSON' } })
  })
})
