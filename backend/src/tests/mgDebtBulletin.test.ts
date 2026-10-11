import { describe, expect, it } from '@jest/globals'
import { assertDebtBulletinPdf, bulletinLinks, pdfLink } from '@/adapters/mgDebtBulletin'

describe('boletim da dívida de Minas', () => {
  it('aceita um PDF e recusa HTML no lugar do arquivo', () => {
    expect(() => assertDebtBulletinPdf(Buffer.from('%PDF-1.7\n'))).not.toThrow()
    expect(() => assertDebtBulletinPdf(Buffer.from('<html>erro</html>'))).toThrow('não é um PDF')
  })

  it('escolhe um PDF por mês e ignora anos que a página não publica', () => {
    const html = `
      <a href="/tesouro-estadual/divida-publica/boletins-da-divida-publica/janeiro-de-2020-00001/">jan</a>
      <a href="/export/sites/fazenda/tesouro-estadual/divida-publica/boletins-da-divida-publica/dezembro-de-2025/Boletim-SCGOV-Dezembro-.2025.pdf">dez</a>
      <a href="/tesouro-estadual/divida-publica/boletins-da-divida-publica/dezembro-de-2025/">página</a>
    `
    const links = bulletinLinks(html)
    expect(links.map((link) => `${link.year}-${link.month}`)).toEqual(['2020-1', '2025-12'])
    expect(links[1]?.url).toMatch(/\.pdf$/)
    expect(pdfLink('<a href="/boletim.pdf">x</a>')).toBe('https://www.fazenda.mg.gov.br/boletim.pdf')
  })
})
