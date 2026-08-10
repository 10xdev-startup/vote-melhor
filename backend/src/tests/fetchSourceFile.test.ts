import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { get as httpsGet } from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fetchSourceFile } from '@/utils/fetchSourceFile'

jest.mock('node:https', () => ({ get: jest.fn() }))

const mockedHttpsGet = httpsGet as jest.MockedFunction<typeof httpsGet>

beforeEach(() => {
  mockedHttpsGet.mockReset()
})

function mockResponse(statusCode: number, body = ''): void {
  mockedHttpsGet.mockImplementationOnce(((_url: URL, _options: unknown, callback: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest
    const stream = new PassThrough()
    const response = stream as unknown as IncomingMessage
    response.statusCode = statusCode

    queueMicrotask(() => {
      callback(response)
      stream.end(body)
    })

    return request
  }) as typeof httpsGet)
}

describe('fetchSourceFile', () => {
  it('forca TLS 1.2 apenas no host afetado e devolve os bytes', async () => {
    mockResponse(200, 'conteudo')

    await expect(fetchSourceFile('https://www.senado.gov.br/arquivo.csv')).resolves.toEqual(
      Buffer.from('conteudo'),
    )

    expect(mockedHttpsGet).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ maxVersion: 'TLSv1.2' }),
      expect.any(Function),
    )
  })

  it('mantem a negociacao TLS padrao para outros hosts', async () => {
    mockResponse(200, 'ok')

    await fetchSourceFile('https://dados.gov.br/arquivo.csv')

    const options = mockedHttpsGet.mock.calls[0]?.[1]
    expect(options).not.toHaveProperty('maxVersion')
  })

  it('traduz status da origem em erro 502 estavel', async () => {
    mockResponse(503)

    await expect(fetchSourceFile('https://www.senado.gov.br/arquivo.csv')).rejects.toMatchObject({
      status: 502,
      code: 'SOURCE_UNAVAILABLE',
    })
  })
})
