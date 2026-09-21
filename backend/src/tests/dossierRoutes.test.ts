import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals'
import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dossierRoutes } from '@/routes/dossierRoutes'
import { errorHandler } from '@/middleware/errorHandler'
import { DossierModel } from '@/models/DossierModel'

jest.mock('@/middleware/supabaseMiddleware', () => ({ supabaseMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization
  if (!['Bearer author', 'Bearer admin', 'Bearer user'].includes(token ?? '')) { res.status(401).json({ success: false }); return }
  const id = token!.slice(7); req.user = { id, role: id === 'admin' ? 'admin' : 'user', email: '', name: null, status: 'active', avatarUrl: null }; next()
} }))
jest.mock('@/models/DossierModel', () => ({ DossierModel: { saveDraft: jest.fn(), listDrafts: jest.fn(), getDraft: jest.fn(), publish: jest.fn(), listPublished: jest.fn(), getPublished: jest.fn() } }))
let server: Server
let url: string
beforeAll(() => {
  process.env['DOSSIER_AUTHOR_USER_ID'] = 'author'
  const app = express(); app.use('/dossiers', dossierRoutes); app.use(express.json()); app.use(errorHandler)
  server = app.listen(0); url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => { server.close(); delete process.env['DOSSIER_AUTHOR_USER_ID'] })
const input = { title: 'Senado', markdown: 'texto', sourceId: null, codeCommit: 'a'.repeat(40) }
function send(path: string, token: string, body: unknown, method = 'PUT') { return fetch(url + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
describe('rotas de dossiês', () => {
  it('exige JWT e UUID específico para enviar', async () => { expect((await send('/dossiers/senado/draft', '', input)).status).toBe(401); expect((await send('/dossiers/senado/draft', 'user', input)).status).toBe(403); expect((await send('/dossiers/senado/draft', 'admin', input)).status).toBe(403) })
  it('autor comum não lê administração nem publica', async () => { expect((await fetch(url + '/dossiers/admin', { headers: { Authorization: 'Bearer author' } })).status).toBe(403); expect((await send('/dossiers/admin/senado/publish', 'author', {}, 'POST')).status).toBe(403) })
  it('payload de publicação injetado é recusado', async () => { expect((await send('/dossiers/senado/draft', 'author', { ...input, published: input })).status).toBe(422) })
  it('aceita 120KiB após autenticação, antes do parser global de 100KiB', async () => {
    jest.mocked(DossierModel.saveDraft).mockResolvedValueOnce({ slug: 'senado', draft: input, published: null, draft_updated_at: 'now', published_at: null })
    expect((await send('/dossiers/senado/draft', 'author', { ...input, markdown: 'a'.repeat(120 * 1024) })).status).toBe(200)
  })
  it('tamanho excedido e JSON inválido usam 413/400 envelopados', async () => {
    expect((await send('/dossiers/senado/draft', 'author', { ...input, markdown: 'a'.repeat(1024 * 1024) })).status).toBe(413)
    const invalid = await fetch(url + '/dossiers/senado/draft', { method: 'PUT', headers: { Authorization: 'Bearer author', 'Content-Type': 'application/json' }, body: '{' }); expect(invalid.status).toBe(400); expect(await invalid.json()).toMatchObject({ success: false, error: { code: 'INVALID_JSON' } })
  })
  it('admin publica somente com data do rascunho', async () => {
    expect((await send('/dossiers/admin/senado/publish', 'admin', {}, 'POST')).status).toBe(400)
    jest.mocked(DossierModel.publish).mockResolvedValueOnce()
    expect((await send('/dossiers/admin/senado/publish', 'admin', { draftUpdatedAt: '2026-09-20T12:00:00.123456+00:00' }, 'POST')).status).toBe(200)
  })
})
