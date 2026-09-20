import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readDossier, pushDossier } from './push-dossier.mjs'
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
function fixture(content = '# Senado\n\nTexto.') {
  const dir = mkdtempSync(join(tmpdir(), 'dossier-test-'))
  const file = join(dir, 'draft.md'); writeFileSync(file, content)
  return { args: [file, '--slug', 'senado-teste', '--title', 'Senado', '--code-commit', commit], cleanup: () => rmSync(dir, { recursive: true }) }
}
describe('push-dossier', () => {
  it('dry-run não chama rede e não imprime conteúdo', async () => {
    const f = fixture(); try { const result = await pushDossier([...f.args, '--dry-run'], {}, () => { throw Error('não deveria chamar') }); assert.equal(result.dryRun, true); assert.equal('markdown' in result, false) } finally { f.cleanup() }
  })
  it('recusa UTF-8 inválido e limite por bytes', () => {
    for (const content of [Buffer.from([0xff]), 'é'.repeat(65537)]) { const f = fixture(content); try { assert.throws(() => readDossier(f.args)) } finally { f.cleanup() } }
  })
  it('recusa flags desconhecidas e SHA abreviado', () => {
    const f = fixture(); try { assert.throws(() => readDossier([...f.args, '--publish'])); assert.throws(() => readDossier([...f.args.slice(0, -1), 'HEAD'])) } finally { f.cleanup() }
  })
  it('envia só rascunho e não devolve token', async () => {
    const f = fixture(); try { const result = await pushDossier(f.args, { API_URL: 'http://localhost:3001', BEARER_TOKEN: 'segredo' }, async (url, options) => { assert.equal(url, 'http://localhost:3001/dossiers/senado-teste/draft'); assert.equal(options.redirect, 'error'); assert.equal(JSON.parse(options.body).published, undefined); return new Response(JSON.stringify({ success: true, data: { slug: 'senado-teste', draftUpdatedAt: 'agora' } })) }); assert.equal(JSON.stringify(result).includes('segredo'), false) } finally { f.cleanup() }
  })
  it('informa renovação no 401 sem refletir corpo remoto', async () => {
    const f = fixture(); try { await assert.rejects(pushDossier(f.args, { API_URL: 'https://example.org', BEARER_TOKEN: 'segredo' }, async () => new Response('segredo', { status: 401 })), /Renove BEARER_TOKEN/) } finally { f.cleanup() }
  })
})
