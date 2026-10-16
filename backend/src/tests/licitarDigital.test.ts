import { describe, expect, it } from '@jest/globals'
import { anexosForDisputa, assertLicitarPdf, LICITAR_DOCUMENTS, licitarDigitalAdapter } from '@/adapters/licitarDigital'

describe('anexos da Licitar Digital', () => {
  it('aceita um PDF e recusa HTML no lugar do arquivo', () => {
    expect(() => assertLicitarPdf(Buffer.from('%PDF-1.7\n'))).not.toThrow()
    expect(() => assertLicitarPdf(Buffer.from('<html>erro</html>'))).toThrow('não é um PDF')
  })

  it('guarda só os três arquivos que a página já publica', async () => {
    const plan = await licitarDigitalAdapter.discover(async () => { throw new Error('a lista já é conhecida') })
    expect(plan.resources.map((item) => item.name)).toEqual([
      '113514-impugnacao-assinada',
      '113514-julgamento-impugnacao',
      '113514-edital',
    ])
    expect(plan.resources.map((item) => item.url)).toEqual(LICITAR_DOCUMENTS.map((document) => document.url))
    expect(plan.resources.every((item) => item.format === 'PDF' && item.kind === 'document')).toBe(true)
    expect(plan.source.official_url).toBe('https://app2.licitardigital.com.br/pesquisa/113514')
  })

  it('oferece os PDFs guardados só no processo que já tem arquivo', () => {
    expect(anexosForDisputa('https://app2.licitardigital.com.br/pesquisa/113514').map((item) => item.label)).toEqual(['Edital', 'Impugnação', 'Julgamento'])
    expect(anexosForDisputa('https://compras.gov.br')).toEqual([])
    expect(anexosForDisputa(null)).toEqual([])
  })
})
