import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { CAMARA_RECORD_YEAR, clearCamaraCache, fetchCamaraVotingDataset, isPublicNominalVoting } from '@/utils/fetchCamara'
import type { CamaraRawVote, CamaraRawVoting } from '@/types/camara'

const originalFetch = global.fetch

function jsonResponse(payload: unknown, lastModified?: string): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: lastModified ? { 'Content-Type': 'application/json', 'Last-Modified': lastModified } : { 'Content-Type': 'application/json' },
  })
}

function voting(id: string, organ = 'PLEN'): CamaraRawVoting {
  return { id, apiUrl: null, date: '2026-08-13', organ, approval: true, yes: 1, no: 0, other: 0, description: 'Aprovado.' }
}

function vote(votingId: string, officialCode: string): CamaraRawVote {
  return { votingId, recordedAt: null, officialCode, deputyId: 1, deputyName: 'Deputada', partyAtTime: 'PARTIDO', state: 'DF' }
}

beforeEach(() => clearCamaraCache())

afterEach(() => {
  global.fetch = originalFetch
})

describe('isPublicNominalVoting', () => {
  it('aceita somente Plenário com escolha individual pública', () => {
    expect(isPublicNominalVoting(voting('1'), [vote('1', 'Sim')])).toBe(true)
    expect(isPublicNominalVoting(voting('1', 'CCJC'), [vote('1', 'Sim')])).toBe(false)
    expect(isPublicNominalVoting(voting('1'), [])).toBe(false)
  })

  it('remove a votação secreta inteira quando a Câmara publica linhas vazias', () => {
    expect(isPublicNominalVoting(voting('1'), [vote('1', ''), vote('1', '')])).toBe(false)
  })
})

describe('fetchCamaraVotingDataset', () => {
  it('segue a paginação e cruza apenas as nominais públicas do Plenário', async () => {
    const mockedFetch = jest.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      if (url.includes('/deputados?pagina=2')) {
        return jsonResponse({ dados: [{ id: 2, nome: 'Bruno', siglaPartido: 'P2', siglaUf: 'SP' }], links: [] })
      }
      if (url.includes('/deputados?')) {
        return jsonResponse({
          dados: [{ id: 1, nome: 'Ana', siglaPartido: 'P1', siglaUf: 'DF', uri: 'https://api/deputados/1' }],
          links: [{ rel: 'next', href: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2&itens=100' }],
        })
      }
      if (url.includes('/votacoes/json/')) {
        return jsonResponse({ dados: [
          { id: 'publica', uri: 'https://api/votacoes/publica', data: '2026-08-13', siglaOrgao: 'PLEN', aprovacao: 1, votosSim: 1, votosNao: 0, votosOutros: 0, descricao: 'Aprovada.' },
          { id: 'secreta', data: '2026-08-13', siglaOrgao: 'PLEN', votosSim: 1, votosNao: 0, votosOutros: 0 },
          { id: 'comissao', data: '2026-08-13', siglaOrgao: 'CCJC', votosSim: 1, votosNao: 0, votosOutros: 0 },
        ] }, 'Sun, 16 Aug 2026 06:50:34 GMT')
      }
      if (url.includes('/votacoesVotos/json/')) {
        return jsonResponse({ dados: [
          { idVotacao: 'publica', voto: 'Sim', deputado_: { id: '1', nome: 'Ana', siglaPartido: 'P1', siglaUf: 'DF' } },
          { idVotacao: 'secreta', voto: '', deputado_: { id: '1', nome: 'Ana' } },
          { idVotacao: 'comissao', voto: 'Sim', deputado_: { id: '2', nome: 'Bruno' } },
        ] }, 'Sun, 16 Aug 2026 06:57:59 GMT')
      }
      if (url.includes('/votacoesProposicoes/json/')) {
        return jsonResponse({ dados: [
          { idVotacao: 'publica', proposicao_: { id: 10, titulo: 'PL 1/2026', ementa: 'Ementa', uri: 'https://api/proposicoes/10' } },
          { idVotacao: 'secreta', proposicao_: { id: 11, titulo: 'OBJ 1/2026' } },
        ] })
      }
      return new Response('', { status: 404 })
    })
    global.fetch = mockedFetch as typeof fetch

    const dataset = await fetchCamaraVotingDataset()

    expect(dataset.deputies.map((item) => item.name)).toEqual(['Ana', 'Bruno'])
    expect(dataset.votings.map((item) => item.id)).toEqual(['publica'])
    expect(dataset.votes).toHaveLength(1)
    expect(dataset.affectedPropositions.map((item) => item.proposition.title)).toEqual(['PL 1/2026'])
    expect(dataset.sourceUpdatedAt).toBe('2026-08-16T06:57:59.000Z')
    expect(mockedFetch).toHaveBeenCalledTimes(5)
  })

  it('falha fechado quando o placar diverge das linhas publicadas', async () => {
    const mockedFetch = jest.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      if (url.includes('/deputados?')) return jsonResponse({ dados: [], links: [] })
      if (url.includes('/votacoes/json/')) return jsonResponse({ dados: [{ id: '1', siglaOrgao: 'PLEN', votosSim: 2, votosNao: 0, votosOutros: 0 }] })
      if (url.includes('/votacoesVotos/json/')) return jsonResponse({ dados: [{ idVotacao: '1', voto: 'Sim', deputado_: { id: 1, nome: 'Ana' } }] })
      if (url.includes('/votacoesProposicoes/json/')) return jsonResponse({ dados: [] })
      return new Response('', { status: 404 })
    })
    global.fetch = mockedFetch as typeof fetch

    await expect(fetchCamaraVotingDataset()).rejects.toMatchObject({ code: 'SOURCE_INCONSISTENT' })
  })
})

describe('CAMARA_RECORD_YEAR', () => {
  it('expõe explicitamente o recorte leve da primeira entrega', () => {
    expect(CAMARA_RECORD_YEAR).toBe(2026)
  })
})
