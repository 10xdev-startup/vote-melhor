import { describe, expect, it } from '@jest/globals'
import { buildDeputyRecord, camaraVoteMargin, classifyCamaraVote, isContestedCamaraVoting, tallyCamaraVotes } from '@/utils/normalizeCamaraVote'

describe('classifyCamaraVote', () => {
  it.each([
    ['Sim', 'yes'],
    ['Não', 'no'],
    ['Abstenção', 'abstention'],
    ['Obstrução', 'obstruction'],
  ])('classifica %s como escolha %s', (officialCode, choice) => {
    expect(classifyCamaraVote(officialCode)).toMatchObject({ category: 'voted', choice })
  })

  it('não acusa de ausência quem presidiu sob o Artigo 17', () => {
    expect(classifyCamaraVote('Artigo 17')).toMatchObject({
      category: 'not_eligible',
      choice: null,
      label: 'Presidiu a sessão',
    })
  })

  it('trata a string vazia como sigilo, não como voto desconhecido', () => {
    expect(classifyCamaraVote('')).toMatchObject({ category: 'secret', choice: null })
  })

  it('preserva um código novo sem inventar significado', () => {
    expect(classifyCamaraVote('Novo código')).toEqual({
      officialCode: 'Novo código',
      category: 'unclassified',
      choice: null,
      label: 'Novo código',
      officialLabel: null,
    })
  })
})

describe('tallyCamaraVotes', () => {
  it('separa o placar das posições sem conteúdo', () => {
    expect(tallyCamaraVotes(['Sim', 'Sim', 'Não', 'Abstenção', 'Obstrução', 'Artigo 17', 'Novo'])).toEqual({
      yes: 2,
      no: 1,
      abstention: 1,
      obstruction: 1,
      notEligible: 1,
      unclassified: 1,
      totalPublished: 7,
    })
  })
})

describe('buildDeputyRecord', () => {
  it('não cria taxa nem denominador de presença a partir de linhas que omitem ausentes', () => {
    const record = buildDeputyRecord(209787, ['Sim', 'Não', 'Artigo 17'])

    expect(record).toEqual({
      deputyId: 209787,
      recordedVoteCount: 2,
      presidedCount: 1,
      choices: { yes: 1, no: 1, abstention: 0, obstruction: 0 },
    })
    expect(record).not.toHaveProperty('participationRate')
    expect(record).not.toHaveProperty('absentCount')
  })
})

describe('isContestedCamaraVoting', () => {
  const tally = (yes: number, no: number) => ({ yes, no, abstention: 0, obstruction: 0, notEligible: 0, unclassified: 0, totalPublished: yes + no })

  it('mede a margem somente entre Sim e Não', () => {
    expect(camaraVoteMargin({ ...tally(52, 48), abstention: 400 })).toBe(0.04)
    expect(isContestedCamaraVoting(tally(52, 48))).toBe(true)
  })

  it('exclui quórum baixo e margem igual ou superior a 10%', () => {
    expect(isContestedCamaraVoting(tally(3, 2))).toBe(false)
    expect(isContestedCamaraVoting(tally(11, 9))).toBe(false)
    expect(isContestedCamaraVoting(tally(60, 40))).toBe(false)
  })
})
