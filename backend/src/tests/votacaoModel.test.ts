import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fetchNominalVotacoes } from '@/utils/fetchSenado'
import { VotacaoModel } from '@/models/VotacaoModel'
import type { SenadoRawVotacao } from '@/types/senado'

jest.mock('@/utils/fetchSenado', () => ({ fetchNominalVotacoes: jest.fn(), currentYear: () => 2026, RECORD_FROM_YEAR: 2019 }))

const mockedVotacoes = fetchNominalVotacoes as jest.MockedFunction<typeof fetchNominalVotacoes>

interface VotacaoOptions {
  ementa?: string | null
  descricao?: string | null
  identificacao?: string | null
  resultado?: string | null
  votos?: Array<{ code: number; name: string; sigla: string; partido?: string }>
}

function votacao(sequencial: number, dataSessao: string, options: VotacaoOptions = {}): SenadoRawVotacao {
  return {
    codigoSessaoVotacao: sequencial * 10,
    sequencialVotacao: sequencial,
    dataSessao,
    identificacao: options.identificacao === undefined ? `PL ${sequencial}/2026` : options.identificacao,
    ementa: options.ementa === undefined ? `Ementa ${sequencial}` : options.ementa,
    descricaoVotacao: options.descricao === undefined ? `Descrição ${sequencial}` : options.descricao,
    codigoMateria: 1000 + sequencial,
    votacaoSecreta: 'N',
    resultadoVotacao: options.resultado === undefined ? 'A' : options.resultado,
    votos: (options.votos ?? []).map((vote) => ({
      codigoParlamentar: vote.code,
      nomeParlamentar: vote.name,
      siglaPartidoParlamentar: vote.partido ?? 'PARTIDO',
      siglaUFParlamentar: 'DF',
      siglaVotoParlamentar: vote.sigla,
    })),
  }
}

function votos(sim: number, nao: number): Array<{ code: number; name: string; sigla: string }> {
  const rows: Array<{ code: number; name: string; sigla: string }> = []
  for (let i = 0; i < sim; i += 1) rows.push({ code: i + 1, name: `Sim ${i}`, sigla: 'Sim' })
  for (let i = 0; i < nao; i += 1) rows.push({ code: 500 + i, name: `Nao ${i}`, sigla: 'Não' })
  return rows
}

beforeEach(() => {
  mockedVotacoes.mockReset()
})

describe('VotacaoModel.listVotacoes — agrupamento por matéria', () => {
  /**
   * O problema que o agrupamento resolve: a `PEC 6/2019` foi ao plenario 11 vezes, uma por
   * dispositivo. Sem agrupar, viram 11 cards com a ementa identica e a tela parece repetida.
   */
  it('junta as votações da mesma matéria num grupo só', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-03-01', { identificacao: 'PEC 6/2019', ementa: 'Reforma da previdência', descricao: 'Emenda nº 2' }),
      votacao(2, '2026-03-02', { identificacao: 'PEC 6/2019', ementa: 'Reforma da previdência', descricao: 'Emenda nº 4' }),
      votacao(3, '2026-03-03', { identificacao: 'PL 1/2026', ementa: 'Outra coisa' }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.coverage.votacaoCount).toBe(3)
    expect(payload.coverage.materiaCount).toBe(2)
    const pec = payload.materias.find((item) => item.identification === 'PEC 6/2019')
    expect(pec?.votacoes).toHaveLength(2)
    expect(pec?.summary).toBe('Reforma da previdência')
  })

  /** Ementa e link sobem para a materia; o que fica na votacao e o dispositivo. */
  it('mantém na votação só o que a diferencia das irmãs', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-03-01', { identificacao: 'PEC 6/2019', descricao: 'Emenda nº 2' }),
      votacao(2, '2026-03-02', { identificacao: 'PEC 6/2019', descricao: 'Emenda nº 4' }),
    ])

    const payload = await VotacaoModel.listVotacoes()
    const pec = payload.materias[0]

    expect(pec?.officialUrl).toBe('https://www25.senado.leg.br/web/atividade/materias/-/materia/1002')
    // Cronologica CRESCENTE dentro da materia: e a ordem em que a sessao aconteceu.
    expect(pec?.votacoes.map((item) => item.description)).toEqual(['Emenda nº 2', 'Emenda nº 4'])
  })

  it('ordena as matérias pela votação mais recente', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-02-01', { identificacao: 'PL 1/2026' }),
      votacao(2, '2026-08-12', { identificacao: 'PL 2/2026' }),
      votacao(3, '2026-05-10', { identificacao: 'PL 3/2026' }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias.map((item) => item.identification)).toEqual(['PL 2/2026', 'PL 3/2026', 'PL 1/2026'])
    expect(payload.materias[0]?.lastDate).toBe('2026-08-12')
  })

  it('não perde votação que venha sem identificação', async () => {
    mockedVotacoes.mockResolvedValue([votacao(1, '2026-03-01', { identificacao: null })])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias).toHaveLength(1)
    expect(payload.materias[0]?.votacoes).toHaveLength(1)
  })
})

describe('VotacaoModel.listVotacoes — o rito de destaque', () => {
  /**
   * O caso que confunde na tela: `PLP 18/2021` teve uma votacao aprovada e duas rejeitadas no
   * mesmo dia. Nao e contradicao — o plenario aprovou o texto-base "ressalvados os destaques"
   * e depois derrubou as duas emendas destacadas. Sao 42 materias assim no recorte.
   */
  it('separa a votação do texto-base das votações de destaque', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-07-15', { identificacao: 'PLP 18/2021', descricao: 'Votação do Projeto, nos termos dos pareceres, ressalvados os destaques.', resultado: 'A', votos: votos(65, 2) }),
      votacao(2, '2026-07-15', { identificacao: 'PLP 18/2021', descricao: 'Votação da Emenda nº 2, destacada.', resultado: 'R', votos: votos(25, 33) }),
      votacao(3, '2026-07-15', { identificacao: 'PLP 18/2021', descricao: 'Votação da Emenda nº 4, destacada.', resultado: 'R', votos: votos(14, 37) }),
    ])

    const payload = await VotacaoModel.listVotacoes()
    const materia = payload.materias[0]

    expect(materia?.votacoes.map((item) => item.kind)).toEqual(['base_text', 'highlight', 'highlight'])
  })

  /** O desfecho da materia e o do texto-base — e o que aconteceu com a lei. */
  it('leva o resultado do texto-base para o topo da matéria', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-07-15', { identificacao: 'PLP 18/2021', descricao: 'Votação do Projeto, ressalvados os destaques.', resultado: 'A' }),
      votacao(2, '2026-07-15', { identificacao: 'PLP 18/2021', descricao: 'Votação da Emenda nº 2, destacada.', resultado: 'R' }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias[0]?.baseTextResult).toBe('approved')
  })

  /**
   * NAO inferir o desfecho da ultima votacao: medido no recorte, a ultima e a votacao
   * principal em apenas 20% das materias. Sem texto-base identificado, a materia fica sem
   * desfecho em vez de receber um chute.
   */
  it('cala sobre o desfecho quando não há votação de texto-base', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-07-15', { identificacao: 'PL 9/2026', descricao: 'Votação da Emenda nº 1, destacada.', resultado: 'R' }),
      votacao(2, '2026-07-16', { identificacao: 'PL 9/2026', descricao: 'Votação da Emenda nº 3, destacada.', resultado: 'A' }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias[0]?.baseTextResult).toBeNull()
    expect(payload.materias[0]?.votacoes.filter((item) => item.kind === 'highlight')).toHaveLength(2)
  })

  it('deixa sem rótulo a votação que a descrição não permite classificar', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-07-15', { identificacao: 'PL 9/2026', descricao: 'Projeto de Lei da Câmara nº 115, de 2018' }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias[0]?.votacoes[0]?.kind).toBeNull()
    expect(payload.materias[0]?.baseTextResult).toBeNull()
  })
})

describe('VotacaoModel.listVotacoes — resultado e disputa', () => {
  it('diz se a matéria foi aprovada ou rejeitada', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-03-01', { identificacao: 'PL 1/2026', resultado: 'A' }),
      votacao(2, '2026-03-02', { identificacao: 'PL 2/2026', resultado: 'R' }),
      votacao(3, '2026-03-03', { identificacao: 'PL 3/2026', resultado: null }),
    ])

    const payload = await VotacaoModel.listVotacoes()
    const results = payload.materias.map((item) => item.votacoes[0]?.result)

    expect(results).toContain('approved')
    expect(results).toContain('rejected')
    expect(results).toContain(null)
  })

  /** No dado real sao 27 de 585; o resto e unanime ou folgado e nao separa ninguem. */
  it('conta quantas votações foram decididas no fio', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-03-01', { identificacao: 'PLP 68/2024', votos: votos(33, 32) }),
      votacao(2, '2026-03-02', { identificacao: 'PL 2/2026', votos: votos(69, 0) }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.coverage.contestedCount).toBe(1)
    const disputada = payload.materias.find((item) => item.identification === 'PLP 68/2024')
    expect(disputada?.contestedCount).toBe(1)
    expect(disputada?.votacoes[0]?.contested).toBe(true)
    expect(payload.materias.find((item) => item.identification === 'PL 2/2026')?.contestedCount).toBe(0)
  })

  it('soma as disputadas dentro da matéria que foi fatiada', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-03-01', { identificacao: 'PEC 6/2019', votos: votos(33, 32) }),
      votacao(2, '2026-03-02', { identificacao: 'PEC 6/2019', votos: votos(31, 30) }),
      votacao(3, '2026-03-03', { identificacao: 'PEC 6/2019', votos: votos(70, 1) }),
    ])

    const payload = await VotacaoModel.listVotacoes()

    expect(payload.materias[0]?.contestedCount).toBe(2)
    expect(payload.materias[0]?.votacoes).toHaveLength(3)
  })
})

describe('VotacaoModel.getVotacao', () => {
  it('devolve null para pauta fora do período coberto', async () => {
    mockedVotacoes.mockResolvedValue([votacao(1, '2026-08-12')])

    await expect(VotacaoModel.getVotacao('999')).resolves.toBeNull()
  })

  /** A votacao aberta precisa da ementa e do link, que na lista moram no grupo. */
  it('reúne o que é da matéria com o que é da votação', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-08-12', { identificacao: 'PLP 68/2024', ementa: 'Institui o IBS', descricao: 'Emenda nº 3', resultado: 'R', votos: votos(33, 32) }),
    ])

    const detail = await VotacaoModel.getVotacao('1')

    expect(detail?.identification).toBe('PLP 68/2024')
    expect(detail?.summary).toBe('Institui o IBS')
    expect(detail?.description).toBe('Emenda nº 3')
    expect(detail?.result).toBe('rejected')
    expect(detail?.contested).toBe(true)
    expect(detail?.officialUrl).toBe('https://www25.senado.leg.br/web/atividade/materias/-/materia/1001')
  })

  /** Quem votou primeiro, depois quem esteve presente sem votar, depois quem faltou. */
  it('agrupa por voto: sim, não, presente sem votar e ausente', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-08-12', {
        votos: [
          { code: 1, name: 'Zuleide Ausente', sigla: 'NCom' },
          { code: 2, name: 'Ana Contra', sigla: 'Não' },
          { code: 3, name: 'Bruno Presente', sigla: 'P-NRV' },
          { code: 4, name: 'Carla Favor', sigla: 'Sim' },
        ],
      }),
    ])

    const detail = await VotacaoModel.getVotacao('1')

    expect(detail?.votes.map((row) => row.name)).toEqual(['Carla Favor', 'Ana Contra', 'Bruno Presente', 'Zuleide Ausente'])
  })

  it('ordena alfabeticamente dentro do mesmo voto', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-08-12', {
        votos: [
          { code: 1, name: 'Zilda', sigla: 'Sim' },
          { code: 2, name: 'Ávila', sigla: 'Sim' },
          { code: 3, name: 'Bruno', sigla: 'Sim' },
        ],
      }),
    ])

    const detail = await VotacaoModel.getVotacao('1')

    expect(detail?.votes.map((row) => row.name)).toEqual(['Ávila', 'Bruno', 'Zilda'])
  })

  it('guarda o partido da época do voto', async () => {
    mockedVotacoes.mockResolvedValue([
      votacao(1, '2026-08-12', { votos: [{ code: 1, name: 'Senadora', sigla: 'Sim', partido: 'PFL' }] }),
    ])

    const detail = await VotacaoModel.getVotacao('1')

    expect(detail?.votes[0]?.party).toBe('PFL')
    expect(detail?.votes[0]?.vote.choice).toBe('yes')
  })
})
