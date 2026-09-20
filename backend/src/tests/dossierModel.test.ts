import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { DossierModel } from '@/models/DossierModel'
import { supabase } from '@/database/supabase'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn() } }))
const from = jest.mocked(supabase.from)
const calls: { method: string; args: unknown[] }[] = []
function query(data: unknown, error: { code?: string; message: string } | null = null) {
  const result = { data, error }
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of ['update', 'insert', 'select', 'eq', 'not', 'order', 'maybeSingle', 'single']) chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain }
  from.mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>)
}
const draft = { title: 'Privado', markdown: 'segredo', sourceId: null, codeCommit: 'a'.repeat(40) }
const timestamp = '2026-09-20T12:00:00.123456+00:00'
beforeEach(() => { from.mockReset(); calls.length = 0 })
describe('DossierModel', () => {
  it('atualiza só o rascunho e preserva publicação', async () => {
    query({ slug: 'senado', draft }); await DossierModel.saveDraft('senado', draft, 'author')
    expect(calls.find((call) => call.method === 'update')?.args[0]).toEqual({ draft, submitted_by: 'author' })
  })
  it('criação concorrente reutiliza slug sem duplicar', async () => {
    query(null); query(null, { code: '23505', message: 'duplicate' }); query({ slug: 'senado', draft })
    expect((await DossierModel.saveDraft('senado', draft, 'author')).slug).toBe('senado'); expect(from).toHaveBeenCalledTimes(3)
  })
  it('lista pública seleciona metadados publicados, sem corpo ou draft', async () => {
    query([]); await DossierModel.listPublished('fonte')
    expect(calls.find((call) => call.method === 'select')?.args[0]).toBe('slug,title:published->>title,sourceId:published->>sourceId,published_at')
    expect(calls).toContainEqual({ method: 'eq', args: ['published->>sourceId', 'fonte'] })
  })
  it('detalhe público nunca devolve linha do banco nem rascunho', async () => {
    query({ slug: 'senado', draft, submitted_by: 'private', published: { ...draft, title: 'Público' }, published_at: timestamp })
    const result = await DossierModel.getPublished('senado'); expect(result.content.title).toBe('Público'); expect(result).not.toHaveProperty('draft'); expect(result).not.toHaveProperty('submitted_by')
  })
  it('rascunho privado resulta em 404 no detalhe público', async () => { query(null); await expect(DossierModel.getPublished('senado')).rejects.toMatchObject({ status: 404 }) })
  it('erro de banco não vira biblioteca vazia', async () => { query(null, { message: 'database failed' }); await expect(DossierModel.listPublished()).rejects.toThrow('database failed') })
  it('publica cópia conferida com precisão de microssegundos e autor', async () => {
    query({ draft, draft_updated_at: timestamp }); query({ slug: 'senado' }); await DossierModel.publish('senado', timestamp, 'admin')
    expect(calls).toContainEqual({ method: 'eq', args: ['draft_updated_at', timestamp] })
    expect(calls.find((call) => call.method === 'update')?.args[0]).toMatchObject({ published: draft, published_by: 'admin' })
  })
  it('recusa a tela desatualizada antes de escrever', async () => {
    query({ draft, draft_updated_at: timestamp }); await expect(DossierModel.publish('senado', 'antigo', 'admin')).rejects.toMatchObject({ status: 409 }); expect(calls.some((call) => call.method === 'update')).toBe(false)
  })
  it('recusa corrida entre leitura e update condicional', async () => {
    query({ draft, draft_updated_at: timestamp }); query(null); await expect(DossierModel.publish('senado', timestamp, 'admin')).rejects.toMatchObject({ status: 409 })
  })
})
