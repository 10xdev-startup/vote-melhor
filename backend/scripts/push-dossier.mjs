#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const root = fileURLToPath(new URL('../../', import.meta.url))
export function readDossier(args) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: { slug: { type: 'string' }, title: { type: 'string' }, 'source-id': { type: 'string' }, 'code-commit': { type: 'string' }, 'dry-run': { type: 'boolean' } } })
  const slug = values.slug
  if (positionals.length !== 1) throw new Error('Informe um arquivo Markdown como argumento')
  if (!slug || slug.length < 3 || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Slug inválido (3–80 caracteres minúsculos, números e hífens)')
  if (!values.title?.trim() || values.title.length > 160) throw new Error('Informe --title com até 160 caracteres')
  const codeCommit = values['code-commit']
  if (!codeCommit || !/^[a-f0-9]{40}$/.test(codeCommit)) throw new Error('Informe --code-commit com o SHA completo do código analisado')
  try { execFileSync('git', ['cat-file', '-e', `${codeCommit}^{commit}`], { cwd: root, stdio: 'ignore' }) }
  catch { throw new Error('Commit não encontrado neste repositório') }
  const bytes = readFileSync(resolve(positionals[0]))
  if (bytes.length > 128 * 1024) throw new Error('Markdown excede 128 KiB')
  let markdown
  try { markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw new Error('Arquivo não é UTF-8 válido') }
  if (!markdown.trim()) throw new Error('Markdown vazio')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(markdown)) throw new Error('Markdown contém caracteres inválidos')
  const sourceId = values['source-id'] ?? null
  if (sourceId !== null && !/^[a-z0-9-]{1,120}$/.test(sourceId)) throw new Error('source-id inválido; use um id do catálogo')
  return { slug, dryRun: values['dry-run'] === true, payload: { title: values.title.trim(), markdown, sourceId, codeCommit }, bytes: bytes.length }
}
export async function pushDossier(args, env = process.env, transport = fetch) {
  const document = readDossier(args)
  if (document.dryRun) return { dryRun: true, slug: document.slug, bytes: document.bytes, codeCommit: document.payload.codeCommit, sourceId: document.payload.sourceId }
  if (!env.API_URL || !env.BEARER_TOKEN) throw new Error('Configure API_URL e BEARER_TOKEN de uma sessão da conta autora autorizada')
  const base = new URL(env.API_URL)
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('API_URL deve conter apenas a origem da API')
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('API_URL exige HTTPS, exceto em localhost')
  let response
  try {
    response = await transport(`${base.origin}/dossiers/${document.slug}/draft`, { method: 'PUT', redirect: 'error', headers: { Authorization: `Bearer ${env.BEARER_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(document.payload), signal: AbortSignal.timeout(30_000) })
  } catch { throw new Error('Falha de conexão ou timeout. Confira a API e reenvie o mesmo slug; o envio nunca publica.') }
  if (response.status === 401) throw new Error('Sessão expirada ou inválida. Renove BEARER_TOKEN e tente novamente.')
  if (response.status === 403) throw new Error('Esta conta não está autorizada a enviar dossiês.')
  if (!response.ok) throw new Error(`Envio recusado (HTTP ${response.status}). Confira o tamanho, a fonte do catálogo e o formato do documento.`)
  let result
  try { result = await response.json() } catch { throw new Error('Resposta inválida da API; confira o rascunho antes de reenviar.') }
  if (result.success !== true || result.data?.slug !== document.slug || typeof result.data?.draftUpdatedAt !== 'string') throw new Error('Resposta inesperada da API; confira o rascunho antes de reenviar.')
  return { slug: document.slug, draftUpdatedAt: result.data.draftUpdatedAt, reviewPath: `/admin/dossies/${document.slug}` }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  pushDossier(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error instanceof Error ? error.message : 'Falha ao enviar dossiê'); process.exitCode = 1 })
}
