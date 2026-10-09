import { describe, expect, it } from '@jest/globals'
import { camaraCurrentDeputiesAdapter, senadoCurrentProcessesAdapter } from '@/adapters/legislativeScreenInputs'
import { CAMARA_CURRENT_DEPUTIES_URL } from '@/utils/legislativeArchiveRequests'

const next = 'https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=2'
describe('recursos necessários às telas legislativas', () => {
  it('publica a primeira página por último e fixa todas as dependências da coleta', async () => {
    const plan = await camaraCurrentDeputiesAdapter.discover(async (url) => ({ fetchedAt: '2026-10-08T20:00:00Z', body: Buffer.from(JSON.stringify({ dados: [{ id: url === CAMARA_CURRENT_DEPUTIES_URL ? 1 : 2, nome: 'Nome' }], links: url === CAMARA_CURRENT_DEPUTIES_URL ? [{ rel: 'next', href: next }] : [] })) }))
    expect(plan.resources.map((resource) => resource.name)).toEqual(['deputados-em-exercicio-pagina-2', 'deputados-em-exercicio-pagina-1'])
    expect(plan.resources[1]?.dependencies).toEqual(['deputados-em-exercicio-pagina-2'])
    expect(plan.resources[1]?.collected?.body).toBeDefined()
    expect(plan.source.metadata).toMatchObject({ deputyCount: 2, pageCount: 2, completePagination: true })
  })
  it('rejeita duplicação de deputados e paginação em host diferente', async () => {
    for (const target of [next, 'https://evil.example/deputados']) {
      await expect(camaraCurrentDeputiesAdapter.discover(async () => ({ fetchedAt: '2026-10-08T20:00:00Z', body: Buffer.from(JSON.stringify({ dados: [{ id: 1, nome: 'Nome' }], links: [{ rel: 'next', href: target }] })) }))).rejects.toThrow(/duplicada|inválida/)
    }
  })
  it('deriva as consultas de tramitação da trilha existente', async () => {
    const plan = await senadoCurrentProcessesAdapter.discover(async () => { throw new Error('Descoberta não deve consultar a origem') })
    expect(plan.resources).toHaveLength(1)
    expect(plan.resources[0]).toMatchObject({ name: 'processo-PEC-221-2019', url: 'https://legis.senado.leg.br/dadosabertos/processo?sigla=PEC&numero=221&ano=2019', optional: false, storageEncoding: 'gzip' })
  })
})
