import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { DeputyModel } from '@/models/DeputyModel'
import { fetchCamaraVotingDataset } from '@/utils/fetchCamara'
import type { CamaraRawDeputy, CamaraRawVoting, CamaraVotingDataset } from '@/types/camara'

jest.mock('@/utils/fetchCamara', () => ({
  fetchCamaraVotingDataset: jest.fn(),
  CAMARA_RECORD_YEAR: 2026,
  CAMARA_SOURCE_URLS: ['https://fonte/deputados', 'https://fonte/votacoes', 'https://fonte/votos', 'https://fonte/proposicoes'],
}))

const mockedDataset = fetchCamaraVotingDataset as jest.MockedFunction<typeof fetchCamaraVotingDataset>

function deputy(id: number, name: string, party = 'PARTIDO'): CamaraRawDeputy {
  return {
    id,
    name,
    party,
    state: 'DF',
    photoUrl: `https://camara/foto/${id}.jpg`,
    apiUrl: `https://api/deputados/${id}`,
    officialPageUrl: `https://www.camara.leg.br/deputados/${id}`,
  }
}

function voting(id: string, date: string, approval: boolean | null = true): CamaraRawVoting {
  return {
    id,
    apiUrl: `https://api/votacoes/${id}`,
    date,
    organ: 'PLEN',
    approval,
    yes: 1,
    no: 1,
    other: 1,
    description: `Descrição ${id}`,
  }
}

function serve(overrides: Partial<CamaraVotingDataset> = {}): void {
  mockedDataset.mockResolvedValue({
    deputies: [deputy(1, 'Ana'), deputy(2, 'Bruno')],
    votings: [voting('v1', '2026-03-01'), voting('v2', '2026-08-13', null)],
    votes: [
      { votingId: 'v1', recordedAt: null, officialCode: 'Sim', deputyId: 1, deputyName: 'Ana', partyAtTime: 'P1', state: 'DF' },
      { votingId: 'v1', recordedAt: null, officialCode: 'Não', deputyId: 2, deputyName: 'Bruno', partyAtTime: 'P2', state: 'SP' },
      { votingId: 'v1', recordedAt: null, officialCode: 'Artigo 17', deputyId: 3, deputyName: 'Ex-deputado', partyAtTime: 'P3', state: 'RJ' },
      { votingId: 'v2', recordedAt: null, officialCode: 'Artigo 17', deputyId: 1, deputyName: 'Ana', partyAtTime: 'ANTIGO', state: 'DF' },
    ],
    affectedPropositions: [
      { votingId: 'v1', proposition: { id: 10, title: 'REQ 1/2026', summary: 'Urgência', apiUrl: 'https://api/proposicoes/10', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/10' } },
      { votingId: 'v1', proposition: { id: 11, title: 'PL 2/2026', summary: 'Projeto', apiUrl: 'https://api/proposicoes/11', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/11' } },
    ],
    sourceUpdatedAt: '2026-08-16T06:57:59.000Z',
    ...overrides,
  })
}

beforeEach(() => {
  mockedDataset.mockReset()
})

describe('DeputyModel.listDeputies', () => {
  it('lista somente o retrato atual, sem promover ex-deputado que aparece nos votos', async () => {
    serve()

    const payload = await DeputyModel.listDeputies()

    expect(payload.deputies.map((item) => item.name)).toEqual(['Ana', 'Bruno'])
    expect(payload.deputies.some((item) => item.id === 3)).toBe(false)
  })

  it('conta escolhas publicadas sem inventar ausência ou taxa', async () => {
    serve()

    const payload = await DeputyModel.listDeputies()
    const ana = payload.deputies[0]

    expect(ana?.record).toEqual({
      deputyId: 1,
      recordedVoteCount: 1,
      presidedCount: 1,
      choices: { yes: 1, no: 0, abstention: 0, obstruction: 0 },
    })
    expect(ana?.record).not.toHaveProperty('participationRate')
    expect(ana?.record).not.toHaveProperty('absentCount')
  })

  it('expõe período, frescor e todas as fontes do cruzamento', async () => {
    serve()

    const payload = await DeputyModel.listDeputies()

    expect(payload.coverage).toEqual({ year: 2026, lastDate: '2026-08-13', votingCount: 2 })
    expect(payload.sourceUpdatedAt).toBe('2026-08-16T06:57:59.000Z')
    expect(payload.sourceUrls).toHaveLength(4)
  })
})

describe('DeputyModel.getDeputy', () => {
  it('devolve null para quem não está mais em exercício', async () => {
    serve()
    await expect(DeputyModel.getDeputy(3)).resolves.toBeNull()
  })

  it('ordena do voto mais recente para o antigo e preserva partido da época', async () => {
    serve()

    const detail = await DeputyModel.getDeputy(1)

    expect(detail?.votes.map((row) => row.votingId)).toEqual(['v2', 'v1'])
    expect(detail?.votes[0]?.partyAtTime).toBe('ANTIGO')
    expect(detail?.votes[0]?.vote.category).toBe('not_eligible')
    expect(detail?.votes[0]?.result).toBeNull()
  })

  it('leva todas as proposições afetadas e a fonte oficial para a linha', async () => {
    serve()

    const detail = await DeputyModel.getDeputy(1)
    const row = detail?.votes.find((item) => item.votingId === 'v1')

    expect(row?.propositions.map((item) => item.title)).toEqual(['PL 2/2026', 'REQ 1/2026'])
    expect(row?.propositions.every((item) => item.officialPageUrl.includes('camara.leg.br'))).toBe(true)
    expect(row?.officialUrl).toBe('https://api/votacoes/v1')
    expect(row?.tally).toEqual({ yes: 1, no: 1, abstention: 0, obstruction: 0, notEligible: 1, unclassified: 0, totalPublished: 3 })
  })
})
