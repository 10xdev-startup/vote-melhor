import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearSenadoCache, fetchSenadoProcess } from '@/utils/fetchSenado'

const originalFetch = global.fetch

beforeEach(() => clearSenadoCache())

afterEach(() => {
  global.fetch = originalFetch
})

describe('fetchSenadoProcess', () => {
  it('consulta uma matéria pelo número e preserva status, frescor e documento oficial', async () => {
    const mockedFetch = jest.fn(async (input: string | URL | Request): Promise<Response> => {
      expect(String(input)).toContain('/processo?sigla=PEC&numero=221&ano=2019')
      return new Response(JSON.stringify([
        {
          apelido: 'Fim da escala 6x1',
          codigoMateria: 174386,
          dataApresentacao: '2026-05-28',
          dataSituacaoAtual: '2026-05-28',
          dataUltimaAtualizacao: '2026-07-08T12:27:06.747',
          identificacao: 'PEC 221/2019',
          objetivo: 'Revisora',
          situacaoAtual: 'AGUARDANDO DESPACHO',
          tramitando: 'Sim',
          urlDocumento: 'http://legis.senado.gov.br/documento.pdf',
        },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    global.fetch = mockedFetch as typeof fetch

    await expect(fetchSenadoProcess('PEC', 221, 2019)).resolves.toEqual({
      identification: 'PEC 221/2019',
      popularName: 'Fim da escala 6x1',
      matterCode: 174386,
      presentedAt: '2026-05-28',
      status: 'AGUARDANDO DESPACHO',
      statusAt: '2026-05-28',
      sourceUpdatedAt: '2026-07-08T12:27:06.747',
      processing: true,
      objective: 'Revisora',
      documentUrl: 'https://legis.senado.gov.br/documento.pdf',
    })
  })

  it('devolve null quando a matéria não existe no filtro', async () => {
    global.fetch = jest.fn(async (): Promise<Response> => new Response('[]', { status: 200 })) as typeof fetch
    await expect(fetchSenadoProcess('PEC', 221, 2019)).resolves.toBeNull()
  })
})
