import type { Request, Response } from 'express'
import { describe, expect, it, jest } from '@jest/globals'
import { createCatalogArchiveAdapters } from '@/adapters/catalogArchive'
import { DataCatalogController } from '@/controllers/DataCatalogController'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { fetchSourceFile } from '@/utils/fetchSourceFile'

jest.mock('@/models/OfficialDataModel')
jest.mock('@/utils/fetchSourceFile')
const model = jest.mocked(OfficialDataModel)

describe('arquivo do catálogo', () => {
  it('deriva exatamente os 57 recursos cadastrados, incluindo parâmetros SOAP', async () => {
    const adapters = createCatalogArchiveAdapters()
    const plans = await Promise.all(adapters.map((adapter) => adapter.discover(async () => { throw new Error('Não coletar na descoberta') })))
    expect(plans.flatMap((plan) => plan.resources)).toHaveLength(57)
    expect(plans.flatMap((plan) => plan.resources).filter((resource) => resource.load)).toHaveLength(17)
    const sp = plans.find((plan) => plan.source.id === 'sp-execucao-investimentos')!
    expect(sp.resources[0]?.schema).toMatchObject({ request: { method: 'POST', parameters: { year: 2010 } } })
  })
  it('valida o conteúdo original e rejeita página HTML com HTTP 200', async () => {
    const adapter = createCatalogArchiveAdapters()[0]!
    const plan = await adapter.discover(async () => { throw new Error('Não coletar na descoberta') })
    const spec = plan.resources.find((resource) => resource.format === 'CSV')!
    expect(spec.parse!(Buffer.from('codigo;valor\n001;10.00\n'))).toEqual([])
    expect(spec.validate!([], new Map())).toMatchObject({ rows: 1, archiveOnly: true })
    expect(() => spec.parse!(Buffer.from('<html><body>Erro</body></html>'))).toThrow('HTML')
  })
  it('o preview existente lê o original preservado sem solicitar o arquivo ao governo', async () => {
    jest.clearAllMocks()
    model.storedOriginal.mockResolvedValue(Buffer.from('codigo;valor\n001;10.00\n'))
    const response = { status: jest.fn<() => Response>(), json: jest.fn() }
    response.status.mockReturnValue(response as unknown as Response)
    await DataCatalogController.preview({ params: { id: 'senado-receitas-csv' }, query: {} } as unknown as Request, response as unknown as Response)
    expect(model.storedOriginal).toHaveBeenCalledWith('senado-receitas-proprias', 'senado-receitas-csv')
    expect(fetchSourceFile).not.toHaveBeenCalled()
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ totalRowCount: 1 }) }))
  })
  it('falha de banco não vira ausência de arquivo nem dispara consulta ao governo', async () => {
    jest.clearAllMocks()
    model.storedOriginal.mockRejectedValue(new Error('Banco indisponível'))
    await expect(DataCatalogController.preview({ params: { id: 'senado-receitas-csv' }, query: {} } as unknown as Request, {} as Response)).rejects.toThrow('Banco indisponível')
    expect(fetchSourceFile).not.toHaveBeenCalled()
  })
})
