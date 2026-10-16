import { describe, expect, it } from '@jest/globals'
import { matchesBid, toFederalBid, type BidQuery } from '@/services/federalBids'

describe('pregões federais do PNCP', () => {
  it('fica só com órgão federal e monta o link do edital', () => {
    const bid = toFederalBid({
      numeroControlePNCP: '00394452000103-1-000100/2025',
      anoCompra: 2025,
      sequencialCompra: 100,
      modalidadeNome: 'Pregão - Eletrônico',
      objetoCompra: 'Aquisição de notebooks',
      valorTotalEstimado: 15000,
      dataEncerramentoProposta: '2026-10-20T18:00:00',
      linkSistemaOrigem: 'https://compras.gov.br',
      orgaoEntidade: { cnpj: '00394452000103', razaoSocial: 'COMANDO DO EXERCITO', esferaId: 'F' },
      unidadeOrgao: { ufSigla: 'SP', municipioNome: 'Taubaté', nomeUnidade: 'BASE' },
    })
    expect(bid?.pncpUrl).toBe('https://pncp.gov.br/app/editais/00394452000103/2025/100')
    expect(bid?.orgao).toBe('COMANDO DO EXERCITO')
  })

  it('aceita município e aplica UF com texto do objeto', () => {
    const bid = toFederalBid({
      anoCompra: 2026, sequencialCompra: 1, objetoCompra: 'Contratação de serviço de tecnologia da informação',
      orgaoEntidade: { cnpj: '1', razaoSocial: 'Estado de Minas Gerais', esferaId: 'E' },
      unidadeOrgao: { ufSigla: 'MG', municipioNome: 'Belo Horizonte', nomeUnidade: 'SEPLAG' },
    })
    const query: BidQuery = { uf: 'MG', cidade: '', esfera: 'E', modalidade: '6', assunto: 'ti', recorte: '' }
    expect(bid && matchesBid(bid, query)).toBe(true)
    expect(bid && matchesBid(bid, { ...query, uf: 'SP' })).toBe(false)
    expect(bid && matchesBid(bid, { ...query, assunto: 'alimentacao' })).toBe(false)
  })
})
