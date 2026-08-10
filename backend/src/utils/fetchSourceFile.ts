import { get as httpsGet, type RequestOptions } from 'node:https'
import type { IncomingMessage } from 'node:http'
import { AppError } from '@/utils/AppError'

const FETCH_TIMEOUT_MS = 20_000

// O balanceador do Senado nao conclui o handshake com o ClientHello TLS 1.3 do Node 22.
// curl e openssl tambem acabam negociando TLS 1.2 com esse host. Restrinja o downgrade ao
// dominio afetado para nao desabilitar TLS 1.3 nas demais origens do catalogo.
const TLS_1_2_ONLY_HOSTS = new Set(['www.senado.gov.br', 'www12.senado.leg.br'])

function readBody(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    response.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    response.once('end', () => resolve(Buffer.concat(chunks)))
    response.once('aborted', () => reject(new Error('A origem interrompeu o download')))
    response.once('error', reject)
  })
}

/**
 * Baixa um arquivo oficial no backend. O browser nao pode fazer isso diretamente porque as
 * origens nao enviam CORS. As URLs continuam vindo apenas do catalogo curado pelo servidor.
 */
export async function fetchSourceFile(url: string): Promise<Buffer> {
  const parsedUrl = new URL(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const options: RequestOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent': '10xGov/1.0 (+https://github.com/10xdev/10x-gov)',
      Accept: '*/*',
    },
  }

  if (TLS_1_2_ONLY_HOSTS.has(parsedUrl.hostname)) {
    options.maxVersion = 'TLSv1.2'
  }

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const request = httpsGet(parsedUrl, options, (response) => {
        const status = response.statusCode ?? 502
        if (status < 200 || status >= 300) {
          response.resume()
          reject(new AppError(502, `O orgao respondeu ${status} ao servir o arquivo`, 'SOURCE_UNAVAILABLE'))
          return
        }

        readBody(response).then(resolve, reject)
      })

      request.once('error', reject)
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'O orgao nao respondeu a tempo', 'SOURCE_TIMEOUT')
    }

    const cause = error instanceof Error ? (error.cause ?? error.message) : error
    console.error('[preview] falha ao buscar na origem', { url, cause })
    throw new AppError(502, 'O site do orgao nao respondeu', 'SOURCE_UNAVAILABLE')
  } finally {
    clearTimeout(timer)
  }
}
