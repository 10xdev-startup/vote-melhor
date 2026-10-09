import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { CAMARA_RECORD_YEAR, clearCamaraCache, fetchCamaraVotingDataset, isPublicNominalVoting } from '@/utils/fetchCamara'
import { OfficialDataModel, type ArchivedDocument } from '@/models/OfficialDataModel'
import type { CamaraRawVote, CamaraRawVoting } from '@/types/camara'

jest.mock('@/models/OfficialDataModel')
const model = jest.mocked(OfficialDataModel)
const originalFetch = global.fetch
const fetchedAt = '2026-10-08T20:00:00.000Z'
function jsonArchive(payload: unknown, dependencies: Record<string, string> = {}): ArchivedDocument {
  return { body: Buffer.from(JSON.stringify(payload)), format: 'JSON', fetchedAt, dependencies, sourceUrl: 'https://dadosabertos.camara.leg.br', snapshotId: 'snapshot' }
}
function voteArchive(csv: string): ArchivedDocument { return { ...jsonArchive({}), body: Buffer.from(csv), format: 'CSV' } }
function voting(id: string, organ = 'PLEN'): CamaraRawVoting { return { id, apiUrl: null, date: '2026-08-13', organ, approval: true, yes: 1, no: 0, other: 0, description: 'Aprovado.' } }
function vote(votingId: string, officialCode: string): CamaraRawVote { return { votingId, recordedAt: null, officialCode, deputyId: 1, deputyName: 'Deputada', partyAtTime: 'PARTIDO', state: 'DF' } }
beforeEach(() => { jest.resetAllMocks(); clearCamaraCache(); global.fetch = jest.fn<typeof fetch>(async () => { throw new Error('Origem oficial proibida no teste') }) })
afterEach(() => { global.fetch = originalFetch })

describe('isPublicNominalVoting', () => {
  it('aceita somente Plenário com escolha individual pública', () => {
    expect(isPublicNominalVoting(voting('1'), [vote('1', 'Sim')])).toBe(true)
    expect(isPublicNominalVoting(voting('1', 'CCJC'), [vote('1', 'Sim')])).toBe(false)
    expect(isPublicNominalVoting(voting('1'), [])).toBe(false)
  })
  it('remove a votação secreta inteira quando a Câmara publica linhas vazias', () => { expect(isPublicNominalVoting(voting('1'), [vote('1', ''), vote('1', '')])).toBe(false) })
})

describe('fetchCamaraVotingDataset', () => {
  it('segue versões fixadas da paginação e cruza CSV com JSON sem consultar o governo', async () => {
    model.readArchive.mockImplementation(async (url) => {
      if (url.includes('/deputados?pagina=2')) return jsonArchive({ dados: [{ id: 2, nome: 'Bruno', siglaPartido: 'P2', siglaUf: 'SP' }], links: [] })
      if (url.includes('/deputados?')) return jsonArchive({ dados: [{ id: 1, nome: 'Ana', siglaPartido: 'P1', siglaUf: 'DF' }], links: [{ rel: 'next', href: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2&itens=100' }] }, { 'deputados-em-exercicio-pagina-2': 'pinned-page-two' })
      if (url.includes('/votacoes/json/')) return jsonArchive({ dados: [
        { id: 'publica', data: '2026-08-13', siglaOrgao: 'PLEN', aprovacao: 1, votosSim: 1, votosNao: 0, votosOutros: 0 },
        { id: 'secreta', siglaOrgao: 'PLEN', votosSim: 1, votosNao: 0, votosOutros: 0 },
        { id: 'comissao', siglaOrgao: 'CCJC', votosSim: 1, votosNao: 0, votosOutros: 0 },
      ] })
      if (url.includes('/votacoesVotos/csv/')) return voteArchive('idVotacao;voto;deputado_id;deputado_nome;deputado_siglaPartido;deputado_siglaUf\npublica;Sim;1;Ana;P1;DF\nsecreta;;1;Ana;P1;DF\ncomissao;Sim;2;Bruno;P2;SP\n')
      if (url.includes('/votacoesProposicoes/json/')) return jsonArchive({ dados: [{ idVotacao: 'publica', proposicao_: { id: 10, titulo: 'PL 1/2026', ementa: 'Ementa' } }, { idVotacao: 'secreta', proposicao_: { id: 11, titulo: 'OBJ 1/2026' } }] })
      throw new Error('Arquivo não declarado')
    })
    const dataset = await fetchCamaraVotingDataset()
    expect(dataset.deputies.map((item) => item.name)).toEqual(['Ana', 'Bruno'])
    expect(dataset.votings.map((item) => item.id)).toEqual(['publica'])
    expect(dataset.votes).toEqual([expect.objectContaining({ deputyId: 1, deputyName: 'Ana', officialCode: 'Sim', state: 'DF' })])
    expect(dataset.affectedPropositions.map((item) => item.proposition.title)).toEqual(['PL 1/2026'])
    expect(dataset.collectedAt).toBe(fetchedAt)
    expect(dataset.sourceUpdatedAt).toBeNull()
    expect(model.readArchive).toHaveBeenCalledWith('https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2&itens=100', 'pinned-page-two')
    expect(global.fetch).not.toHaveBeenCalled()
    await fetchCamaraVotingDataset()
    expect(model.readArchive).toHaveBeenCalledTimes(5)
  })
  it('falha fechado quando o placar diverge das linhas preservadas', async () => {
    model.readArchive.mockImplementation(async (url) => {
      if (url.includes('/deputados?')) return jsonArchive({ dados: [{ id: 1, nome: 'Ana' }], links: [] })
      if (url.includes('/votacoes/json/')) return jsonArchive({ dados: [{ id: '1', siglaOrgao: 'PLEN', votosSim: 2, votosNao: 0, votosOutros: 0 }] })
      if (url.includes('/votacoesVotos/csv/')) return voteArchive('idVotacao;voto;deputado_id\n1;Sim;1\n')
      return jsonArchive({ dados: [] })
    })
    await expect(fetchCamaraVotingDataset()).rejects.toMatchObject({ code: 'SOURCE_INCONSISTENT' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it('recusa próxima página sem vínculo com a coleta e não tenta o governo', async () => {
    model.readArchive.mockImplementation(async (url) => url.includes('/deputados?') ? jsonArchive({ dados: [{ id: 1, nome: 'Ana' }], links: [{ rel: 'next', href: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2' }] }) : url.includes('/csv/') ? voteArchive('idVotacao;voto\n') : jsonArchive({ dados: [] }))
    await expect(fetchCamaraVotingDataset()).rejects.toMatchObject({ code: 'ARCHIVE_RESOURCE_NOT_READY' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it('propaga falha de armazenamento sem fallback externo', async () => {
    model.readArchive.mockRejectedValue(new Error('Storage indisponível'))
    await expect(fetchCamaraVotingDataset()).rejects.toThrow('Storage indisponível')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
describe('CAMARA_RECORD_YEAR', () => { it('preserva o recorte atual das telas', () => { expect(CAMARA_RECORD_YEAR).toBe(2026) }) })
