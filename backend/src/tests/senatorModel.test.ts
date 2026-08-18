import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fetchCurrentSenators, fetchNominalVotacoes } from '@/utils/fetchSenado'
import { SenatorModel } from '@/models/SenatorModel'
import type { SenadoRawSenator, SenadoRawVotacao } from '@/types/senado'

jest.mock('@/utils/fetchSenado', () => ({
  fetchCurrentSenators: jest.fn(),
  fetchNominalVotacoes: jest.fn(),
  currentYear: () => 2026,
  RECORD_FROM_YEAR: 2019,
}))

const mockedSenators = fetchCurrentSenators as jest.MockedFunction<typeof fetchCurrentSenators>
const mockedVotacoes = fetchNominalVotacoes as jest.MockedFunction<typeof fetchNominalVotacoes>

/**
 * Mandato de senador dura 8 anos e cobre DUAS legislaturas de 4. Quem foi eleito em 2018 tem
 * primeira=56 (2019-2023) e segunda=57 (2023-2027) — e e o `DataFim` da segunda que diz
 * quando a cadeira volta para a urna.
 */
function senator(code: number, name: string, mandateEndsAt: string): SenadoRawSenator {
  return {
    code,
    name,
    party: 'PARTIDO',
    state: 'DF',
    photoUrl: null,
    officialPageUrl: null,
    firstLegislature: mandateEndsAt === '2027-01-31' ? '56' : '57',
    mandateEndsAt,
  }
}

interface VotacaoOptions {
  secreta?: boolean
  codigoMateria?: number | null
  votos?: Array<{ code: number; sigla: string; partido?: string }>
}

function votacao(sequencial: number, dataSessao: string, options: VotacaoOptions = {}): SenadoRawVotacao {
  return {
    codigoSessaoVotacao: sequencial * 10,
    sequencialVotacao: sequencial,
    dataSessao,
    identificacao: `PL ${sequencial}/2024`,
    ementa: `Ementa da votação ${sequencial}`,
    descricaoVotacao: `Descrição da votação ${sequencial}`,
    codigoMateria: options.codigoMateria === undefined ? 1000 + sequencial : options.codigoMateria,
    votacaoSecreta: options.secreta ? 'S' : 'N',
    resultadoVotacao: 'A',
    votos: (options.votos ?? []).map((vote) => ({
      codigoParlamentar: vote.code,
      nomeParlamentar: `Senador ${vote.code}`,
      siglaPartidoParlamentar: vote.partido ?? 'PARTIDO',
      siglaUFParlamentar: 'DF',
      siglaVotoParlamentar: vote.sigla,
    })),
  }
}

/** O carregamento (recorte de anos + filtro de nominais) vive no `fetchSenado`, ja mockado. */
function serve(votacoes: SenadoRawVotacao[]): void {
  mockedVotacoes.mockResolvedValue(votacoes)
}

beforeEach(() => {
  mockedSenators.mockReset()
  mockedVotacoes.mockReset()
})

describe('SenatorModel.listSenators — quem está na urna', () => {
  /**
   * Regressao: a primeira versao lia o `DataFim` da PRIMEIRA legislatura e marcava
   * exatamente o grupo errado — os 27 que seguem ate 2031 apareciam como "na urna", e os 54
   * que de fato disputam a eleicao ficavam de fora.
   */
  it('marca na urna quem tem mandato terminando em 31/01/2027, não o contrário', async () => {
    mockedSenators.mockResolvedValue({
      senators: [senator(1, 'Eleita em 2018', '2027-01-31'), senator(2, 'Eleito em 2022', '2031-01-31')],
      sourceVersion: '16/08/2026 22:14:57',
    })
    serve([])

    const payload = await SenatorModel.listSenators()
    const naUrna = payload.senators.filter((item) => item.onBallot)

    expect(naUrna).toHaveLength(1)
    expect(naUrna[0]?.name).toBe('Eleita em 2018')
  })

  it('carrega a procedência que a fonte publica', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: '16/08/2026 22:14:57' })
    serve([votacao(1, '2026-03-24', { votos: [{ code: 1, sigla: 'Sim' }] })])

    const payload = await SenatorModel.listSenators()

    expect(payload.sourceVersion).toBe('16/08/2026 22:14:57')
    expect(payload.coverage.fromYear).toBe(2019)
    expect(payload.coverage.votacaoCount).toBe(1)
    expect(payload.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  /** Cada senador tem denominador proprio — comparar contagem absoluta entre eles mente. */
  it('dá a cada senador o denominador das votações em que ele aparece', async () => {
    mockedSenators.mockResolvedValue({
      senators: [senator(1, 'Titular', '2027-01-31'), senator(2, 'Suplente recente', '2027-01-31')],
      sourceVersion: null,
    })
    serve([
      votacao(1, '2026-03-01', { votos: [{ code: 1, sigla: 'Sim' }] }),
      votacao(2, '2026-03-02', { votos: [{ code: 1, sigla: 'NCom' }] }),
      votacao(3, '2026-03-03', { votos: [{ code: 1, sigla: 'Sim' }, { code: 2, sigla: 'Sim' }] }),
    ])

    const payload = await SenatorModel.listSenators()
    const titular = payload.senators.find((item) => item.code === 1)
    const suplente = payload.senators.find((item) => item.code === 2)

    expect(titular?.record.eligibleCount).toBe(3)
    expect(suplente?.record.eligibleCount).toBe(1)
    // O suplente marca 100% com uma votacao so. A taxa sozinha nao diz nada sem o denominador.
    expect(suplente?.record.participationRate).toBe(1)
    expect(titular?.record.participationRate).toBeCloseTo(2 / 3)
  })
})

describe('SenatorModel.getSenator', () => {
  it('devolve null para quem não está em exercício', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: null })
    serve([])

    await expect(SenatorModel.getSenator(999)).resolves.toBeNull()
  })

  it('lista o voto a voto do mais recente para o mais antigo', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: null })
    serve([
      votacao(1, '2026-02-01', { votos: [{ code: 1, sigla: 'Sim' }] }),
      votacao(2, '2026-08-12', { votos: [{ code: 1, sigla: 'Não' }] }),
      votacao(3, '2026-05-10', { votos: [{ code: 1, sigla: 'P-NRV' }] }),
    ])

    const detail = await SenatorModel.getSenator(1)

    expect(detail?.votes.map((row) => row.date)).toEqual(['2026-08-12', '2026-05-10', '2026-02-01'])
  })

  it('classifica o voto e guarda o partido da época, não o atual', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: null })
    serve([votacao(1, '2026-03-24', { votos: [{ code: 1, sigla: 'P-NRV', partido: 'PFL' }] })])

    const detail = await SenatorModel.getSenator(1)
    const row = detail?.votes[0]

    expect(row?.vote.category).toBe('present_not_voted')
    expect(row?.vote.officialLabel).toBe('Presente – Não registrou voto')
    expect(row?.partyAtTime).toBe('PFL')
    expect(detail?.party).toBe('PARTIDO')
  })

  it('calcula o placar da votação, que a API entrega nulo', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: null })
    serve([
      votacao(1, '2026-03-24', {
        votos: [
          { code: 1, sigla: 'Sim' },
          { code: 2, sigla: 'Sim' },
          { code: 3, sigla: 'Não' },
          { code: 4, sigla: 'NCom' },
        ],
      }),
    ])

    const detail = await SenatorModel.getSenator(1)

    expect(detail?.votes[0]?.tally.yes).toBe(2)
    expect(detail?.votes[0]?.tally.no).toBe(1)
    expect(detail?.votes[0]?.tally.absent).toBe(1)
  })

  it('monta o link oficial da matéria e aceita votação sem matéria', async () => {
    mockedSenators.mockResolvedValue({ senators: [senator(1, 'Senadora', '2027-01-31')], sourceVersion: null })
    serve([
      votacao(1, '2026-03-24', { codigoMateria: 168484, votos: [{ code: 1, sigla: 'Sim' }] }),
      votacao(2, '2026-03-25', { codigoMateria: null, votos: [{ code: 1, sigla: 'Sim' }] }),
    ])

    const detail = await SenatorModel.getSenator(1)

    expect(detail?.votes[1]?.officialUrl).toBe('https://www25.senado.leg.br/web/atividade/materias/-/materia/168484')
    expect(detail?.votes[0]?.officialUrl).toBeNull()
  })
})
