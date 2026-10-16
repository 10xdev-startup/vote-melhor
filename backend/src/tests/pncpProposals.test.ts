import { describe, expect, it } from '@jest/globals'
import { bidDeadline, selectOpenBids, type StoredBid } from '@/services/federalBids'
import { pncpProposalsAdapter } from '@/adapters/pncpProposals'
import { collectOpenProposals, PNCP_RETRY_DELAYS_MS, proposalsToRecords, type PncpPageResponse } from '@/services/pncpProposals'

function item(id: string, esfera = 'M') {
  return {
    numeroControlePNCP: id,
    anoCompra: 2026,
    sequencialCompra: 1,
    modalidadeNome: 'Pregão - Eletrônico',
    objetoCompra: 'Licença de software',
    dataEncerramentoProposta: '2026-12-01T10:00:00',
    orgaoEntidade: { cnpj: '123', razaoSocial: 'IPASMUN', esferaId: esfera },
    unidadeOrgao: { ufSigla: 'MG', municipioNome: 'Nanuque', nomeUnidade: 'IPASMUN' },
  }
}

function json(data: unknown[], status = 200): PncpPageResponse {
  return { status, body: Buffer.from(JSON.stringify({ data })) }
}

describe('coleta de propostas do PNCP', () => {
  it('prepara um recurso por estado, no mesmo script', async () => {
    const plan = await pncpProposalsAdapter.discover(async () => { throw new Error('não coleta aqui') })
    const names = plan.resources.map((resource) => resource.name)
    expect(names).toHaveLength(27)
    expect(new Set(names).size).toBe(27)
    expect(names).toContain('propostas-mg')
    expect(names).toContain('propostas-sp')
    expect(plan.resources.every((resource) => resource.optional)).toBe(true)
  })

  it('espera e tenta de novo quando o PNCP pede', async () => {
    const sleeps: number[] = []
    let calls = 0
    const archive = await collectOpenProposals({
      uf: 'mg', modalidade: '6', maxPages: 2, now: new Date('2026-10-11T15:00:00Z'),
      sleep: async (ms) => { sleeps.push(ms) },
      get: async () => {
        calls += 1
        if (calls === 1) return { status: 429, body: Buffer.alloc(0) }
        if (calls === 2) return json([item('a')])
        return { status: 204, body: Buffer.alloc(0) }
      },
    })
    expect(sleeps).toEqual([PNCP_RETRY_DELAYS_MS[0], 3000])
    expect(archive.uf).toBe('MG')
    expect(archive.stopped).toBe('end')
    expect(archive.pages).toHaveLength(1)
  })

  it('não publica lista vazia quando as tentativas se esgotam na primeira página', async () => {
    const sleeps: number[] = []
    await expect(collectOpenProposals({
      uf: 'MG', modalidade: '6', maxPages: 1,
      sleep: async (ms) => { sleeps.push(ms) },
      get: async () => ({ status: 429, body: Buffer.alloc(0) }),
    })).rejects.toThrow('HTTP 429')
    expect(sleeps).toEqual([...PNCP_RETRY_DELAYS_MS])
  })

  it('guarda as páginas já baixadas quando a página seguinte esgota as tentativas', async () => {
    let calls = 0
    const archive = await collectOpenProposals({
      uf: 'MG', modalidade: '6', maxPages: 3,
      sleep: async () => {},
      get: async () => {
        calls += 1
        return calls === 1 ? json([item('a'), item('a')]) : { status: 503, body: Buffer.alloc(0) }
      },
    })
    expect(archive.stopped).toBe('rate-limit')
    expect(archive.pages).toHaveLength(1)
    const rows = proposalsToRecords(Buffer.from(JSON.stringify(archive)), archive.modalidade)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.record_key).toBe('a')
    expect(rows[0]?.payload['modalidadeCodigo']).toBe('6')
  })

  it('tira da lista o que já venceu e o que não cabe no filtro', () => {
    const bid = (id: string, esfera: string, encerramento: string): StoredBid => ({
      id, orgao: 'Órgão', unidade: '', uf: 'MG', esfera, cidade: 'Nanuque', objeto: 'Licença de software',
      modalidade: 'Pregão - Eletrônico', encerramento, valorEstimado: null, pncpUrl: 'https://pncp.gov.br', disputaUrl: null, modalidadeCodigo: '6',
    })
    const now = new Date('2026-10-11T15:00:00-03:00')
    const selected = selectOpenBids([
      bid('aberta', 'M', '2026-12-01T10:00:00'),
      bid('vencida', 'M', '2026-10-01T10:00:00'),
      bid('federal', 'F', '2026-12-01T10:00:00'),
    ], { uf: 'MG', cidade: '', esfera: 'M', modalidade: '6', assunto: 'ti', recorte: '' }, now)
    expect(selected.total).toBe(1)
    expect(selected.bids.map((item) => item.id)).toEqual(['aberta'])
    const itaguara = { ...bid('ita', 'M', '2026-12-01T10:00:00'), cidade: 'Itaguara' }
    expect(selectOpenBids([itaguara, bid('nanuque', 'M', '2026-12-01T10:00:00')], { uf: 'MG', cidade: 'itaguara', esfera: '', modalidade: '6', assunto: '', recorte: '' }, now).bids.map((item) => item.id)).toEqual(['ita'])
    const saas = { ...bid('saas', 'M', '2026-12-01T10:00:00'), objeto: 'Assinatura de software como serviço' }
    const maquina = { ...bid('pc', 'M', '2026-12-01T10:00:00'), objeto: 'Aquisição de computador' }
    expect(selectOpenBids([saas, maquina], { uf: 'MG', cidade: '', esfera: '', modalidade: '', assunto: 'ti', recorte: 'saas' }, now).bids.map((item) => item.id)).toEqual(['saas'])
    expect(bidDeadline('2026-10-11T14:00:00')).toBe(Date.parse('2026-10-11T14:00:00-03:00'))
  })
})
