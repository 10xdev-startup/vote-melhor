import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { get as httpsGet } from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearSenadoCache, fetchSenadoProcess } from '@/utils/fetchSenado'

// Mocka `node:https`, nao `global.fetch`: o cliente do Senado passou a usar o
// `officialHttpGet` por causa do handshake TLS que nao fecha em legis.senado.leg.br.
// Com o mock no `fetch`, este teste sairia para a rede de verdade sem avisar.
jest.mock('node:https', () => ({ get: jest.fn() }))

const mockedHttpsGet = httpsGet as jest.MockedFunction<typeof httpsGet>

beforeEach(() => {
  mockedHttpsGet.mockReset()
  clearSenadoCache()
})

function mockJsonResponse(payload: unknown, assertUrl?: (url: string) => void): void {
  mockedHttpsGet.mockImplementationOnce(((url: URL, _options: unknown, callback: (response: IncomingMessage) => void) => {
    assertUrl?.(String(url))

    const request = new EventEmitter() as ClientRequest
    const stream = new PassThrough()
    const response = stream as unknown as IncomingMessage
    response.statusCode = 200
    response.headers = { 'content-type': 'application/json' }

    queueMicrotask(() => {
      callback(response)
      stream.end(JSON.stringify(payload))
    })

    return request
  }) as typeof httpsGet)
}

describe('fetchSenadoProcess', () => {
  it('consulta uma matéria pelo número e preserva status, frescor e documento oficial', async () => {
    mockJsonResponse(
      [
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
      ],
      (url) => expect(url).toContain('/processo?sigla=PEC&numero=221&ano=2019')
    )

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
    mockJsonResponse([])
    await expect(fetchSenadoProcess('PEC', 221, 2019)).resolves.toBeNull()
  })
})
