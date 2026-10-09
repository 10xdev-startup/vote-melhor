import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearSenadoCache, fetchCurrentSenators, fetchNominalVotacoes, getSenadoCollectedAt, RECORD_FROM_YEAR, currentYear } from '@/utils/fetchSenado'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { officialHttpGet } from '@/utils/officialHttpGet'

jest.mock('@/models/OfficialDataModel')
jest.mock('@/utils/officialHttpGet')
const model = jest.mocked(OfficialDataModel)
beforeEach(() => { jest.resetAllMocks(); clearSenadoCache() })
describe('leitura do acervo do Senado', () => {
  it('reutiliza os JSONs preservados e mantém o filtro de votos secretos e a data da coleta', async () => {
    model.readArchive.mockImplementation(async (url) => {
      const payload = url.includes('/senador/') ? { ListaParlamentarEmExercicio: { Metadados: { Versao: '20261008' }, Parlamentares: { Parlamentar: [{ IdentificacaoParlamentar: { CodigoParlamentar: '1', NomeParlamentar: 'Ana', UrlFotoParlamentar: 'http://senado.leg.br/foto.jpg' }, Mandato: { PrimeiraLegislaturaDoMandato: { NumeroLegislatura: '56' }, SegundaLegislaturaDoMandato: { DataFim: '2027-01-31' } } }] } } } : url.includes(`dataInicio=${RECORD_FROM_YEAR}-`) ? [{ sequencialVotacao: 1, votacaoSecreta: 'N', votos: [{ codigoParlamentar: 1, siglaVotoParlamentar: 'Sim' }] }, { sequencialVotacao: 2, votacaoSecreta: 'S', votos: [{ siglaVotoParlamentar: 'Votou' }] }] : []
      return { body: Buffer.from(JSON.stringify(payload)), snapshotId: 'stored-json', sourceUrl: url, format: 'JSON', dependencies: {}, fetchedAt: url.includes('/senador/') ? '2026-10-08T20:00:00.000Z' : '2026-10-07T20:00:00.000Z' }
    })
    const [votacoes, members] = await Promise.all([fetchNominalVotacoes(), fetchCurrentSenators()])
    expect(votacoes.map((vote) => vote.sequencialVotacao)).toEqual([1])
    expect(members).toMatchObject({ sourceVersion: '20261008', senators: [{ code: 1, name: 'Ana', mandateEndsAt: '2027-01-31', photoUrl: 'https://senado.leg.br/foto.jpg' }] })
    expect(getSenadoCollectedAt(true)).toBe('2026-10-07T20:00:00.000Z')
    const count = currentYear() - RECORD_FROM_YEAR + 2
    expect(model.readArchive).toHaveBeenCalledTimes(count)
    await Promise.all([fetchNominalVotacoes(), fetchCurrentSenators()])
    expect(model.readArchive).toHaveBeenCalledTimes(count)
    expect(officialHttpGet).not.toHaveBeenCalled()
  })
  it('não consulta o governo quando o Storage falha', async () => {
    model.readArchive.mockRejectedValue(new Error('Storage indisponível'))
    await expect(fetchCurrentSenators()).rejects.toThrow('Storage indisponível')
    expect(officialHttpGet).not.toHaveBeenCalled()
  })
  it('rejeita JSON inválido ou resposta com formato incompatível', async () => {
    model.readArchive.mockResolvedValue({ body: Buffer.from('{'), snapshotId: 'broken', sourceUrl: 'https://legis.senado.leg.br', format: 'JSON', dependencies: {}, fetchedAt: '2026-10-08T20:00:00Z' })
    await expect(fetchCurrentSenators()).rejects.toMatchObject({ code: 'SOURCE_INVALID_RESPONSE' })
  })
})
