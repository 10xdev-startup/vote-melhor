import { describe, it, expect } from '@jest/globals'
import { validateDossier, validateDossierSlug } from '@/utils/validateDossier'

const input = { title: 'Senado', markdown: '# Fonte\n\nTexto com **ênfase** e [fonte](https://senado.leg.br).', sourceId: 'senado-receitas-proprias', codeCommit: 'a'.repeat(40) }
describe('validateDossier', () => {
  it('aceita Markdown com fonte conhecida e SHA completo', () => { expect(validateDossier(input)).toEqual(input) })
  it.each([{ published: true }, { title: '' }, { sourceId: 'inventada' }, { codeCommit: 'HEAD' }, { markdown: '![imagem](https://example.org/a.png)' }, { markdown: '[link](mailto:someone@example.org)' }])('recusa payload inválido %j', (override) => { expect(() => validateDossier({ ...input, ...override })).toThrow() })
  it('limita bytes e não quantidade de caracteres', () => { expect(() => validateDossier({ ...input, markdown: 'é'.repeat(65537) })).toThrow('128 KiB') })
  it('mantém HTML como texto, sem renderizar conteúdo ativo', () => { expect(validateDossier({ ...input, markdown: '<script>alert(1)</script>' }).markdown).toContain('<script>') })
  it.each(['ab', '../admin', 'a--b', 'A-B', 'a'.repeat(81)])('recusa slug %s', (slug) => { expect(() => validateDossierSlug(slug)).toThrow() })
})
