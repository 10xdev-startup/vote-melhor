import { AppError } from '@/utils/AppError'
import { officialHttpGet } from '@/utils/officialHttpGet'

const FETCH_TIMEOUT_MS = 20_000

/**
 * Baixa um arquivo oficial no backend. O browser nao pode fazer isso diretamente porque as
 * origens nao enviam CORS. As URLs continuam vindo apenas do catalogo curado pelo servidor.
 *
 * O transporte (TLS por host, redirect) fica em `officialHttpGet` — aqui so a traducao do
 * resultado para o erro de dominio.
 */
export async function fetchSourceFile(url: string): Promise<Buffer> {
  try {
    const response = await officialHttpGet(url, { timeoutMs: FETCH_TIMEOUT_MS })

    if (response.status < 200 || response.status >= 300) {
      // 502: quem falhou foi a origem, nao esta API — e o link do catalogo pode ter morrido.
      throw new AppError(502, `O orgao respondeu ${response.status} ao servir o arquivo`, 'SOURCE_UNAVAILABLE')
    }

    return response.body
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'O orgao nao respondeu a tempo', 'SOURCE_TIMEOUT')
    }

    const cause = error instanceof Error ? (error.cause ?? error.message) : error
    console.error('[preview] falha ao buscar na origem', { url, cause })
    throw new AppError(502, 'O site do orgao nao respondeu', 'SOURCE_UNAVAILABLE')
  }
}
