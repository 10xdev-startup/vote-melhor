import { describe, expect, it } from '@jest/globals'
import { isNominalVotacao, RECORD_FROM_YEAR } from '@/utils/fetchSenado'
import type { SenadoRawVotacao } from '@/types/senado'

function votacao(votacaoSecreta: string | null): SenadoRawVotacao {
  return {
    codigoSessaoVotacao: 1,
    sequencialVotacao: 1,
    dataSessao: '2026-03-24',
    identificacao: 'PL 1/2026',
    ementa: null,
    descricaoVotacao: null,
    codigoMateria: null,
    votacaoSecreta,
    resultadoVotacao: 'A',
    votos: [],
  }
}

describe('isNominalVotacao', () => {
  /**
   * Em votacao secreta a API preenche `votos[]` com 81 linhas de `Votou` — parece dado, mas
   * nao diz como ninguem votou. Sao 34,7% de toda a base.
   */
  it('aceita só o que tem voto individual publicado', () => {
    expect(isNominalVotacao(votacao('N'))).toBe(true)
    expect(isNominalVotacao(votacao('S'))).toBe(false)
  })

  it('descarta quando a fonte não informa se foi secreta', () => {
    expect(isNominalVotacao(votacao(null))).toBe(false)
  })
})

describe('RECORD_FROM_YEAR', () => {
  /**
   * 2019 nao e numero redondo escolhido a esmo: e a posse dos 54 senadores que estao na urna
   * em out/2026, e deixa de fora 2015 e 2016, que estao corrompidos na fonte (votacoes dos
   * anos 90 com `dataSessao` errada). Baixar esse valor reintroduz o lixo.
   */
  it('começa depois da janela corrompida da fonte', () => {
    expect(RECORD_FROM_YEAR).toBe(2019)
    expect(RECORD_FROM_YEAR).toBeGreaterThan(2016)
  })
})
