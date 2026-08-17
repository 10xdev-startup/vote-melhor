import { describe, it, expect } from '@jest/globals'
import { buildSenatorRecord, classifyResult, classifyVotacaoKind, classifyVote, isContestedVotacao, tallyVotacao, voteMargin } from '@/utils/normalizeSenadoVote'

/**
 * Fixture real, nao inventada: votacao `sequencialVotacao=4363` (PL 896/2023, 24/03/2026).
 * As 81 siglas sao as que a API devolveu, e o placar foi conferido contra o endpoint
 * `/orientacaoBancada`, que reporta `qtdVotosSim=67` para a mesma votacao.
 */
function repeat(code: string, times: number): string[] {
  return Array.from({ length: times }, () => code)
}

const VOTACAO_4363: string[] = [
  ...repeat('Sim', 67),
  ...repeat('AP', 5),
  ...repeat('P-NRV', 5),
  'NCom',
  'MIS',
  'LS',
  'Presidente (art. 51 RISF)',
]

describe('classifyVote — voto de conteudo conhecido', () => {
  it('separa as quatro escolhas que sao voto de verdade', () => {
    expect(classifyVote('Sim').choice).toBe('yes')
    expect(classifyVote('Não').choice).toBe('no')
    expect(classifyVote('Abstenção').choice).toBe('abstention')
    expect(classifyVote('Obstrução').choice).toBe('obstruction')
  })

  it('trata o voto do presidente pelo art. 48 como voto', () => {
    const voto = classifyVote('Sim - Presidente Art.48 inciso XXIII')
    expect(voto.category).toBe('voted')
    expect(voto.choice).toBe('yes')
  })
})

describe('classifyVote — as armadilhas que produzem numero errado', () => {
  // `Votou` e 34,7% de toda a base (100.153 de 288.774). E o que a API poe no lugar do voto
  // quando a votacao foi secreta: nao carrega escolha nenhuma.
  it('NAO conta `Votou` de votacao secreta como voto', () => {
    const voto = classifyVote('Votou')
    expect(voto.category).toBe('secret')
    expect(voto.choice).toBeNull()
  })

  // Marcar como ausente quem presidiu a sessao seria acusar de faltar quem estava la.
  it('separa quem nao podia votar de quem faltou', () => {
    expect(classifyVote('Presidente (art. 51 RISF)').category).toBe('not_eligible')
    expect(classifyVote('Impedido (art.306 RISF)').category).toBe('not_eligible')
    expect(classifyVote('NCom').category).toBe('absent')
  })

  // `P-NRV` aparece 44.940 vezes. Presente e nao votar nao e a mesma coisa que faltar.
  it('separa presente-sem-votar de ausente', () => {
    expect(classifyVote('P-NRV').category).toBe('present_not_voted')
    expect(classifyVote('P-OD').category).toBe('present_not_voted')
    expect(classifyVote('AP').category).toBe('absent')
  })

  // `MERC` aparece 5 vezes na serie e nao esta em tabela oficial nenhuma. Chutar `absent`
  // seria inventar dado — o produto mostra exatamente o que o Senado publicou.
  it('nao inventa categoria para codigo que o Senado nao documenta', () => {
    const voto = classifyVote('MERC')
    expect(voto.category).toBe('unclassified')
    expect(voto.label).toBe('MERC')
    expect(voto.officialLabel).toBeNull()
  })

  it('nao quebra com codigo novo que o Senado passe a publicar', () => {
    expect(classifyVote('CODIGO-QUE-NAO-EXISTE').category).toBe('unclassified')
  })
})

describe('classifyVote — procedencia', () => {
  // O tooltip mostra o texto oficial; o `label` e curadoria da 10xGov porque o oficial nao
  // cabe na linha. Se o texto oficial for editado aqui, a citacao da fonte vira mentira.
  it('preserva o texto oficial sem editar, incluindo o travessao do P-NRV', () => {
    expect(classifyVote('P-NRV').officialLabel).toBe('Presente – Não registrou voto')
    expect(classifyVote('REP').officialLabel).toBe('Representação em solenidade internac./nac./reg.')
    expect(classifyVote('MIS').officialLabel).toBe('Missão da Casa no País/exterior')
  })

  it('encurta so o rotulo de exibicao, nunca o oficial', () => {
    const voto = classifyVote('REP')
    expect(voto.label).toBe('Representação em solenidade')
    expect(voto.officialLabel).not.toBe(voto.label)
  })

  it('deixa `officialLabel` nulo nos codigos de voto, que a tabela oficial nao cobre', () => {
    expect(classifyVote('Sim').officialLabel).toBeNull()
    expect(classifyVote('Não').officialLabel).toBeNull()
  })
})

describe('tallyVotacao', () => {
  // A API devolve `totalVotosSim/Nao/Abstencao` SEMPRE nulos em votacao nominal.
  it('calcula o placar que a API nao entrega', () => {
    const tally = tallyVotacao(VOTACAO_4363)
    expect(tally.yes).toBe(67)
    expect(tally.no).toBe(0)
  })

  it('publica as 81 cadeiras mas conta como voto so quem votou', () => {
    const tally = tallyVotacao(VOTACAO_4363)
    expect(tally.total).toBe(81)
    expect(tally.yes + tally.no + tally.abstention + tally.obstruction).toBe(67)
  })

  it('distribui o resto nas categorias certas', () => {
    const tally = tallyVotacao(VOTACAO_4363)
    expect(tally.presentNotVoted).toBe(5)
    expect(tally.absent).toBe(8)
    expect(tally.notEligible).toBe(1)
    // As quatro categorias tem que fechar as 81 cadeiras, sem sobra nem duplicata.
    expect(tally.yes + tally.presentNotVoted + tally.absent + tally.notEligible).toBe(81)
  })

  it('nao soma voto em votacao secreta', () => {
    const tally = tallyVotacao([...repeat('Votou', 66), ...repeat('NCom', 15)])
    expect(tally.yes).toBe(0)
    expect(tally.secret).toBe(66)
    expect(tally.absent).toBe(15)
  })

  it('devolve placar zerado para lista vazia', () => {
    const tally = tallyVotacao([])
    expect(tally.total).toBe(0)
    expect(tally.yes).toBe(0)
  })
})

describe('classifyResult', () => {
  it('traduz o código do Senado', () => {
    expect(classifyResult('A')).toBe('approved')
    expect(classifyResult('R')).toBe('rejected')
  })

  // 5 das 585 votacoes do recorte vem sem resultado. Chutar "aprovada" seria inventar.
  it('não chuta quando a fonte não informa', () => {
    expect(classifyResult(null)).toBeNull()
    expect(classifyResult('X')).toBeNull()
  })
})

describe('classifyVotacaoKind', () => {
  it('reconhece o texto-base pela ressalva aos destaques', () => {
    expect(classifyVotacaoKind('Votação nominal do Projeto de Lei Complementar nº 18, de 2021, nos termos dos pareceres, ressalvados os destaques.')).toBe('base_text')
  })

  it('reconhece o pedaço votado à parte', () => {
    expect(classifyVotacaoKind('Votação nominal da Emenda nº 4 ao Projeto de Lei Complementar nº 18, de 2021, destacada.')).toBe('highlight')
  })

  /** Sem descricao que sustente, fica sem rotulo — rotular por eliminacao seria chute. */
  it('não classifica o que a descrição não sustenta', () => {
    expect(classifyVotacaoKind('Projeto de Lei da Câmara nº 115, de 2018')).toBeNull()
    expect(classifyVotacaoKind(null)).toBeNull()
  })
})

describe('voteMargin', () => {
  it('mede a distância do empate, de 0 a 1', () => {
    expect(voteMargin(tallyVotacao([...repeat('Sim', 33), ...repeat('Não', 32)]))).toBeCloseTo(1 / 65)
    expect(voteMargin(tallyVotacao([...repeat('Sim', 40), ...repeat('Não', 40)]))).toBe(0)
    expect(voteMargin(tallyVotacao(repeat('Sim', 70)))).toBe(1)
  })

  /**
   * Abstencao, obstrucao e ausencia nao empurram o resultado para lado nenhum. Se entrassem
   * no denominador, uma votacao apertada com muita ausencia pareceria folgada.
   */
  it('ignora quem não empurrou o resultado', () => {
    const semAusentes = tallyVotacao([...repeat('Sim', 11), ...repeat('Não', 10)])
    const comAusentes = tallyVotacao([...repeat('Sim', 11), ...repeat('Não', 10), ...repeat('NCom', 60)])
    expect(voteMargin(comAusentes)).toBe(voteMargin(semAusentes))
  })

  it('devolve null quando ninguém votou sim nem não', () => {
    expect(voteMargin(tallyVotacao(repeat('P-NRV', 81)))).toBeNull()
  })
})

describe('isContestedVotacao', () => {
  // O IBS da reforma tributaria (PLP 68/2024) caiu por 33 a 32 — 1 voto de diferenca.
  it('marca a votação decidida no fio', () => {
    expect(isContestedVotacao(tallyVotacao([...repeat('Sim', 33), ...repeat('Não', 32)]))).toBe(true)
  })

  // 40% das votacoes do recorte sao unanimes: nao diferenciam senador nenhum.
  it('não marca unanimidade nem votação folgada', () => {
    expect(isContestedVotacao(tallyVotacao(repeat('Sim', 69)))).toBe(false)
    expect(isContestedVotacao(tallyVotacao([...repeat('Sim', 61), ...repeat('Não', 2)]))).toBe(false)
  })

  /** 3 a 2 nao e votacao disputada, e quorum baixo — a margem so significa algo com volume. */
  it('exige volume mínimo para a margem significar algo', () => {
    expect(isContestedVotacao(tallyVotacao([...repeat('Sim', 3), ...repeat('Não', 2)]))).toBe(false)
  })
})

describe('buildSenatorRecord — o denominador que varia', () => {
  it('usa como denominador so as votacoes em que a pessoa podia votar', () => {
    const record = buildSenatorRecord(5672, [...repeat('Sim', 8), 'P-NRV', 'NCom'])
    expect(record.eligibleCount).toBe(10)
    expect(record.votedCount).toBe(8)
    expect(record.participationRate).toBe(0.8)
  })

  // Sem isso, quem presidiu muitas sessoes apareceria com presenca artificialmente baixa.
  it('tira do denominador o que nao era elegivel', () => {
    const record = buildSenatorRecord(1, [...repeat('Sim', 5), ...repeat('Presidente (art. 51 RISF)', 5)])
    expect(record.eligibleCount).toBe(5)
    expect(record.participationRate).toBe(1)
  })

  it('tira do denominador votacao secreta e codigo nao classificado', () => {
    const record = buildSenatorRecord(1, ['Sim', 'Votou', 'MERC'])
    expect(record.eligibleCount).toBe(1)
    expect(record.participationRate).toBe(1)
  })

  /**
   * O ponto que faz comparacao entre senadores mentir: os denominadores nao batem. Na
   * legislatura atual eles vao de 556 a 584, porque quem assumiu como suplente ou entrou no
   * meio do mandato aparece em menos votacoes.
   */
  it('nao deixa comparar contagem absoluta entre denominadores diferentes', () => {
    const veterano = buildSenatorRecord(1, [...repeat('Sim', 300), ...repeat('NCom', 200)])
    const recente = buildSenatorRecord(2, [...repeat('Sim', 90), ...repeat('NCom', 10)])

    // Em numero absoluto o veterano votou mais de 3x. Em taxa, votou muito menos.
    expect(veterano.votedCount).toBeGreaterThan(recente.votedCount)
    expect(veterano.participationRate).toBe(0.6)
    expect(recente.participationRate).toBe(0.9)
    expect(veterano.eligibleCount).not.toBe(recente.eligibleCount)
  })

  it('devolve taxa nula quando nao houve votacao elegivel', () => {
    const record = buildSenatorRecord(1, ['Votou', 'MERC'])
    expect(record.eligibleCount).toBe(0)
    expect(record.participationRate).toBeNull()
  })
})
