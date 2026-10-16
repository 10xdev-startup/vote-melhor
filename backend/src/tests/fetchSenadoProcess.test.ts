import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearSenadoCache, fetchSenadoProcess, getSenadoProcessCollectedAt } from '@/utils/fetchSenado'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { senadoProcessUrl } from '@/utils/legislativeArchiveRequests'

jest.mock('@/models/OfficialDataModel')
const model = jest.mocked(OfficialDataModel)
beforeEach(() => { jest.resetAllMocks(); clearSenadoCache() })
function mockJsonResponse(payload: unknown, assertUrl?: (url: string) => void): void {
  model.readArchive.mockImplementationOnce(async (url) => {
    assertUrl?.(url)
    return { body: Buffer.from(JSON.stringify(payload)), format: 'JSON', fetchedAt: '2026-10-08T20:00:00.000Z', dependencies: {}, sourceUrl: url, snapshotId: 'stored-process' }
  })
}

describe('fetchSenadoProcess', () => {
  it('consulta uma matéria pelo número e preserva status, frescor e documento oficial', async () => {
    mockJsonResponse(
      [
        {
          apelido: 'Fim da escala 6x1',
          codigoMateria: 174386,
          dataApresentacao: '2026-05-28',
          dataSituacaoAtual: '2026-05-28',
          dataUltimaAtualizacao: '2026-07-08T12:27:06.747',
          identificacao: 'PEC 221/2019',
          objetivo: 'Revisora',
          situacaoAtual: 'AGUARDANDO DESPACHO',
          tramitando: 'Sim',
          urlDocumento: 'http://legis.senado.gov.br/documento.pdf',
        },
      ],
      (url) => expect(url).toContain('/processo?sigla=PEC&numero=221&ano=2019')
    )

    await expect(fetchSenadoProcess('PEC', 221, 2019)).resolves.toEqual({
      identification: 'PEC 221/2019',
      popularName: 'Fim da escala 6x1',
      matterCode: 174386,
      presentedAt: '2026-05-28',
      status: 'AGUARDANDO DESPACHO',
      statusAt: '2026-05-28',
      sourceUpdatedAt: '2026-07-08T12:27:06.747',
      processing: true,
      objective: 'Revisora',
      documentUrl: 'https://legis.senado.gov.br/documento.pdf',
    })
  })

  it('devolve null quando a matéria não existe no filtro', async () => {
    mockJsonResponse([])
    await expect(fetchSenadoProcess('PEC', 221, 2019)).resolves.toBeNull()
  })
})

describe('procedência da tramitação preservada', () => {
  it('usa a data real da coleta e não converte erro do banco em matéria ausente', async () => {
    mockJsonResponse([])
    await fetchSenadoProcess('PEC', 221, 2019)
    expect(getSenadoProcessCollectedAt('PEC', 221, 2019)).toBe('2026-10-08T20:00:00.000Z')
    expect(model.readArchive).toHaveBeenCalledWith(senadoProcessUrl('PEC', 221, 2019))
    clearSenadoCache()
    model.readArchive.mockRejectedValue(new Error('Banco indisponível'))
    await expect(fetchSenadoProcess('PEC', 221, 2019)).rejects.toThrow('Banco indisponível')
  })
})
