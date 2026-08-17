import { get as httpsGet, type RequestOptions } from 'node:https'
import type { IncomingMessage } from 'node:http'

/**
 * GET nas origens oficiais. Unico ponto do backend que conhece as peculiaridades de
 * transporte dos servidores do governo — antes esse conhecimento vivia espalhado por cliente,
 * e ja errou: o `fetchSenado` documentava que `legis.senado.leg.br` fechava TLS 1.3
 * normalmente, mas ele estoura `UND_ERR_CONNECT_TIMEOUT` igual aos outros.
 *
 * Duas peculiaridades tratadas aqui:
 *
 * 1. **TLS**: o ClientHello TLS 1.3 do Node nao conclui handshake com varios hosts do Senado.
 *    O erro engana, porque o "connect" do undici engloba o handshake — parece falha de
 *    socket. Fixar `maxVersion: 'TLSv1.2'` resolve; ver
 *    `.cursor/plans/fazendo/fonte-de-dados/investigacao-tls-senado.md`.
 * 2. **Redirect**: `node:https` NAO segue redirect sozinho, e varios endpoints do Senado
 *    respondem 301 para um JSON estatico. Sem seguir, o corpo volta vazio e o parser acusa
 *    erro de formato.
 */

/**
 * Hosts cujo handshake TLS 1.3 nao conclui. **Medido host a host** — nao adicione por
 * suposicao, e nao generalize para o dominio inteiro. Teste antes:
 *
 * ```bash
 * node -e "fetch('<url>').then(r=>console.log(r.status)).catch(e=>console.log(e.cause?.code))"
 * node --tls-max-v1.2 -e "fetch('<url>').then(r=>console.log(r.status))"
 * ```
 *
 * Se o primeiro estoura em ~10,5s e o segundo responde, o host entra aqui.
 */
const TLS_1_2_ONLY_HOSTS = new Set(['www.senado.gov.br', 'www12.senado.leg.br', 'legis.senado.leg.br'])

/** Teto de saltos, para um redirect ciclico nao virar loop infinito. */
const MAX_REDIRECTS = 5

export interface OfficialHttpResponse {
  status: number
  body: Buffer
  headers: IncomingMessage['headers']
}

export interface OfficialHttpOptions {
  headers?: Record<string, string>
  timeoutMs: number
}

function readBody(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    response.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    response.once('end', () => resolve(Buffer.concat(chunks)))
    response.once('aborted', () => reject(new Error('A origem interrompeu a resposta')))
    response.once('error', reject)
  })
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

/**
 * Faz o GET seguindo redirect e aplicando o downgrade de TLS quando o host exige.
 *
 * Devolve a resposta como veio (inclusive status de erro): traduzir para `AppError` e decidir
 * o que e falha e responsabilidade de quem chama, que sabe o contexto.
 */
export async function officialHttpGet(
  url: string,
  options: OfficialHttpOptions,
  redirectsLeft = MAX_REDIRECTS
): Promise<OfficialHttpResponse> {
  const parsedUrl = new URL(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)

  const requestOptions: RequestOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent': '10xGov/1.0 (+https://github.com/10xdev/10x-gov)',
      Accept: '*/*',
      ...options.headers,
    },
  }

  if (TLS_1_2_ONLY_HOSTS.has(parsedUrl.hostname)) {
    requestOptions.maxVersion = 'TLSv1.2'
  }

  try {
    const response = await new Promise<OfficialHttpResponse>((resolve, reject) => {
      const request = httpsGet(parsedUrl, requestOptions, (incoming) => {
        const status = incoming.statusCode ?? 502
        const location = incoming.headers.location

        if (isRedirect(status) && location !== undefined && redirectsLeft > 0) {
          incoming.resume()
          resolve({ status, body: Buffer.alloc(0), headers: incoming.headers })
          return
        }

        readBody(incoming).then(
          (body) => resolve({ status, body, headers: incoming.headers }),
          reject
        )
      })

      request.once('error', reject)
    })

    const location = response.headers.location
    if (isRedirect(response.status) && location !== undefined && redirectsLeft > 0) {
      // `new URL(location, url)` resolve tanto redirect absoluto quanto relativo.
      return await officialHttpGet(new URL(location, url).toString(), options, redirectsLeft - 1)
    }

    return response
  } finally {
    clearTimeout(timer)
  }
}
