import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { CamaraVotingModel } from '@/models/CamaraVotingModel'
import { fetchCamaraVotingDataset } from '@/utils/fetchCamara'

jest.mock('@/utils/fetchCamara', () => ({
  fetchCamaraVotingDataset: jest.fn(),
  CAMARA_RECORD_YEAR: 2026,
  CAMARA_SOURCE_URLS: ['https://fonte/deputados', 'https://fonte/votacoes', 'https://fonte/votos', 'https://fonte/proposicoes'],
}))

const mockedDataset = fetchCamaraVotingDataset as jest.MockedFunction<typeof fetchCamaraVotingDataset>

function serve(): void {
  mockedDataset.mockResolvedValue({
    deputies: [],
    votings: [
      { id: 'v2', apiUrl: 'https://api/votacoes/v2', date: '2026-08-13', organ: 'PLEN', approval: null, yes: 1, no: 0, other: 1, description: 'Votação mais recente' },
      { id: 'v1', apiUrl: 'https://api/votacoes/v1', date: '2026-03-01', organ: 'PLEN', approval: true, yes: 1, no: 1, other: 0, description: 'Votação anterior' },
    ],
    votes: [
      ...Array.from({ length: 10 }, (_, index) => ({ votingId: 'v1', recordedAt: null, officialCode: 'Sim', deputyId: 100 + index, deputyName: `Sim ${index}`, partyAtTime: 'P1', state: 'DF' })),
      ...Array.from({ length: 10 }, (_, index) => ({ votingId: 'v1', recordedAt: null, officialCode: 'Não', deputyId: 200 + index, deputyName: `Não ${index}`, partyAtTime: 'P2', state: 'SP' })),
      { votingId: 'v2', recordedAt: null, officialCode: 'Artigo 17', deputyId: 1, deputyName: 'Ana', partyAtTime: 'ANTIGO', state: 'DF' },
      { votingId: 'v2', recordedAt: null, officialCode: 'Sim', deputyId: 2, deputyName: 'Bruno', partyAtTime: 'P2', state: 'SP' },
    ],
    affectedPropositions: [
      { votingId: 'v1', proposition: { id: 2233802, title: 'PEC 221/2019', summary: 'Reduz a jornada de trabalho', apiUrl: 'https://api/proposicoes/2233802', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/2233802' } },
      { votingId: 'v2', proposition: { id: 2233802, title: 'PEC 221/2019', summary: 'Reduz a jornada de trabalho', apiUrl: 'https://api/proposicoes/2233802', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/2233802' } },
      { votingId: 'v2', proposition: { id: 11, title: 'REQ 1/2026', summary: 'Requerimento relacionado', apiUrl: 'https://api/proposicoes/11', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/11' } },
    ],
    sourceUpdatedAt: '2026-08-16T06:57:59.000Z',
  })
}

beforeEach(() => {
  mockedDataset.mockReset()
  serve()
})

describe('CamaraVotingModel.listVotings', () => {
  it('agrupa pelas proposições afetadas e preserva relações múltiplas', async () => {
    const payload = await CamaraVotingModel.listVotings()

    expect(payload.coverage).toEqual({ year: 2026, lastDate: '2026-08-13', votingCount: 2, propositionCount: 2, relationCount: 3, contestedCount: 1, contestedPropositionCount: 1 })
    expect(payload.propositions.map((group) => group.proposition?.title)).toEqual(['PEC 221/2019', 'REQ 1/2026'])
    expect(payload.propositions[0]?.votings.map((voting) => voting.id)).toEqual(['v1', 'v2'])
    expect(payload.propositions.map((group) => group.contestedCount)).toEqual([1, 0])
    expect(payload.propositions[1]?.votings.map((voting) => voting.id)).toEqual(['v2'])
  })

  it('expõe autoria e nome popular somente com as fontes oficiais que os sustentam', async () => {
    const payload = await CamaraVotingModel.listVotings()
    const group = payload.propositions.find((item) => item.proposition?.id === 2233802)

    expect(group?.authors).toEqual([
      expect.objectContaining({ name: 'Reginaldo Lopes', party: 'PT', state: 'MG', sourceUrl: expect.stringContaining('camara.leg.br/propostas-legislativas/') }),
    ])
    expect(group?.popularNames).toEqual([
      expect.objectContaining({ label: 'Escala 6x1', sourceUrl: expect.stringContaining('camara.leg.br/noticias/') }),
    ])
    expect(group?.journeyId).toBe('scale-6x1')
    expect(payload.propositions.find((item) => item.proposition?.id === 11)?.popularNames).toEqual([])
    expect(payload.propositions.find((item) => item.proposition?.id === 11)?.authors).toEqual([])
    expect(payload.propositions.find((item) => item.proposition?.id === 11)?.journeyId).toBeNull()
  })

  it('não infere resultado quando a Câmara não publica aprovação', async () => {
    const payload = await CamaraVotingModel.listVotings()
    const voting = payload.propositions.flatMap((group) => group.votings).find((item) => item.id === 'v2')

    expect(voting?.result).toBeNull()
    expect(voting).toMatchObject({ margin: 1, contested: false })
    expect(voting?.tally).toEqual({ yes: 1, no: 0, abstention: 0, obstruction: 0, notEligible: 1, unclassified: 0, totalPublished: 2 })
  })
})

describe('CamaraVotingModel.getVoting', () => {
  it('lista somente os votos publicados, com partido da época e todas as proposições', async () => {
    const detail = await CamaraVotingModel.getVoting('v2')

    expect(detail?.propositions.map((item) => item.title)).toEqual(['PEC 221/2019', 'REQ 1/2026'])
    expect(detail?.votes).toHaveLength(2)
    expect(detail?.votes.find((row) => row.name === 'Ana')).toMatchObject({ party: 'ANTIGO', vote: { category: 'not_eligible' } })
    expect(detail).not.toHaveProperty('absentCount')
  })

  it('devolve null para votação fora do recorte', async () => {
    await expect(CamaraVotingModel.getVoting('inexistente')).resolves.toBeNull()
  })
})
