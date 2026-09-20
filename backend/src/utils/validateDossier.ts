import MarkdownIt from 'markdown-it'
import { AppError } from '@/utils/AppError'
import { DataCatalogModel } from '@/models/DataCatalogModel'
import type { DossierContent } from '@/types/dossier'

const parser = new MarkdownIt({ html: false, linkify: false })

export function validateDossierSlug(value: unknown): string {
  if (typeof value !== 'string' || value.length < 3 || value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new AppError(400, 'Slug inválido: use 3 a 80 caracteres, letras minúsculas, números e hífens', 'INVALID_SLUG')
  }
  return value
}

export function validateDossier(value: unknown): DossierContent {
  const fail = (message: string): never => { throw new AppError(422, message, 'INVALID_DOSSIER') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Informe o documento')
  const input = value as Record<string, unknown>
  if (Object.keys(input).sort().join(',') !== 'codeCommit,markdown,sourceId,title') return fail('Campos permitidos: title, markdown, sourceId e codeCommit')
  const { title, markdown, sourceId, codeCommit } = input
  if (typeof title !== 'string' || !title.trim() || title.length > 160) return fail('Título obrigatório de até 160 caracteres')
  if (typeof markdown !== 'string' || !markdown.trim()) return fail('Markdown obrigatório')
  if (Buffer.byteLength(markdown, 'utf8') > 128 * 1024) throw new AppError(413, 'Markdown excede 128 KiB', 'DOSSIER_TOO_LARGE')
  if (Array.from(markdown).some((character) => { const code = character.charCodeAt(0); return (code < 32 && ![9, 10, 13].includes(code)) || code === 65533 })) return fail('Markdown contém caracteres inválidos')
  if (typeof codeCommit !== 'string' || !/^[a-f0-9]{40}$/.test(codeCommit)) return fail('Informe o SHA completo do código analisado')
  if (sourceId !== null && (typeof sourceId !== 'string' || !DataCatalogModel.listDatasets().some((dataset) => dataset.id === sourceId))) return fail('Fonte não encontrada no catálogo')
  for (const token of parser.parse(markdown, {})) {
    for (const child of token.children ?? []) {
      if (child.type === 'image') return fail('Imagens não são suportadas no piloto; use texto, tabelas e diagramas em código')
      if (child.type === 'link_open' && !/^https?:\/\//i.test(child.attrGet('href') ?? '')) return fail('Links devem usar HTTP ou HTTPS')
    }
  }
  return { title: title.trim(), markdown, sourceId: sourceId as string | null, codeCommit }
}
