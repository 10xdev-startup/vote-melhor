import { describe, expect, it } from '@jest/globals'
import { camaraArchiveAdapter, senadoArchiveAdapter, parseCamaraFileIndex, senateFileUrls, inspectArchiveCsv } from '@/adapters/legislativeArchive'

describe('descoberta dos arquivos legislativos', () => {
  it('inspeciona CSV com quebras de linha e separadores entre aspas sem transformar valores', () => {
    expect(inspectArchiveCsv(Buffer.from('id;descricao\r\n001;"linha;um\nlinha"\r\n002;"texto ""citado"""\r\n003\r\n'))).toEqual({ rows: 3, columns: ['id', 'descricao'], rowWidthMismatches: 1 })
    expect(() => inspectArchiveCsv(Buffer.from('id;nome\n1;"truncado'))).toThrow('aspas')
    expect(() => inspectArchiveCsv(Buffer.from('id;nome\n1;\u0000'))).toThrow('NUL')
  })
  it('lê somente JSON do índice oficial e exclui arquivos técnicos e caminhos inseguros', () => {
    const html = `let arquivo = ${JSON.stringify({ deputados: [{ nome_arquivo: 'deputados.json', ano_arquivo: '', tipo_arquivo: 'json' }, { nome_arquivo: '../deputados.json', ano_arquivo: '', tipo_arquivo: 'json' }, { nome_arquivo: 'lock.tmp', ano_arquivo: '', tipo_arquivo: 'tmp' }] })};`
    expect(parseCamaraFileIndex(html)).toHaveLength(1)
    expect(() => parseCamaraFileIndex('let arquivo = executeSomething();')).toThrow('não localizado')
  })
  it('mantém o histórico no catálogo e seleciona a legislatura atual para a primeira carga', async () => {
    const year = new Date().getUTCFullYear()
    const entries = { legislaturas: [{ nome_arquivo: 'legislaturas.json', ano_arquivo: '', tipo_arquivo: 'json' }], proposicoes: [year, year - 10].map((value) => ({ nome_arquivo: `proposicoes-${value}.json`, ano_arquivo: String(value), tipo_arquivo: 'json' })), votacoes: [year - 10, 2000, 1999].map((value) => ({ nome_arquivo: `votacoes-${value}.json`, ano_arquivo: String(value), tipo_arquivo: 'json' })) }
    const plan = await camaraArchiveAdapter.discover(async (url) => ({ fetchedAt: '2026-10-08T00:00:00Z', body: Buffer.from(url.includes('swagger') ? `<html>let arquivo = ${JSON.stringify(entries)};</html>` : url.includes('/legislaturas/') ? JSON.stringify({ dados: [{ idLegislatura: 57, dataInicio: `${year}-01-01`, dataFim: `${year}-12-31` }] }) : JSON.stringify({ paths: {} })) }))
    expect(plan.catalog?.some((resource) => resource.name === `proposicoes-${year - 10}`)).toBe(true)
    expect(plan.resources.some((resource) => resource.name === `proposicoes-${year - 10}`)).toBe(false)
    expect(plan.resources.some((resource) => resource.name === `votacoes-${year - 10}`)).toBe(true)
    expect(plan.resources.some((resource) => resource.name === 'votacoes-2000')).toBe(true)
    expect(plan.resources.some((resource) => resource.name === 'votacoes-1999')).toBe(false)
    expect(plan.catalog?.some((resource) => resource.name === 'votacoes-1999')).toBe(true)
    const voting = plan.resources.find((resource) => resource.name === `proposicoes-${year}`)!
    expect(voting.storageEncoding).toBe('gzip')
    expect(voting.parse!(Buffer.from('{"dados":[{"id":"1"}]}'))).toEqual([])
    expect(voting.validate!([], new Map())).toMatchObject({ records: 1, archiveOnly: true })
    expect(() => voting.parse!(Buffer.from('<html>Erro</html>'))).toThrow('HTML')
    voting.parse!(Buffer.from('{"dados":[]}'))
    expect(voting.validate!([], new Map())).toMatchObject({ records: 0, empty: true, quantitativeInference: 'not-performed' })
  })
  it('extrai somente downloads em hosts oficiais e preserva parâmetros HTML escapados', () => {
    expect(senateFileUrls('<a href="https://legis.senado.leg.br/dadosabertos/votacao.csv?ano=2026&amp;tipo=N">Votos</a><a href="https://evil.example/arquivo.json">X</a><a href="https://legis.senado.leg.br/api-docs/index.html">Doc</a>')).toEqual(['https://legis.senado.leg.br/dadosabertos/votacao.csv?ano=2026&tipo=N'])
  })
  it('prioriza os CSVs oficiais das bases grandes e conserva as alternativas no catálogo', async () => {
    const year = new Date().getUTCFullYear()
    const categories = ['proposicoes', 'votacoesVotos', 'frentesDeputados', 'historicoDeputados']
    const entries = Object.fromEntries(categories.map((category) => [category, ['json', 'csv'].map((format) => ({ nome_arquivo: `${category}-${year}.${format}`, ano_arquivo: String(year), tipo_arquivo: format }))]))
    entries['legislaturas'] = [{ nome_arquivo: 'legislaturas.json', ano_arquivo: '', tipo_arquivo: 'json' }]
    const plan = await camaraArchiveAdapter.discover(async (url) => ({ fetchedAt: new Date().toISOString(), body: Buffer.from(url.includes('swagger') ? `<html>let arquivo = ${JSON.stringify(entries)};</html>` : url.includes('/legislaturas/') ? JSON.stringify({ dados: [{ idLegislatura: 57, dataInicio: `${year}-01-01`, dataFim: `${year}-12-31` }] }) : JSON.stringify({ paths: {} })) }))
    for (const category of categories) {
      const resource = plan.resources.find((item) => item.name === `${category}-${year}`)!
      expect(resource.url).toContain(`/csv/${category}-${year}.csv`)
      expect(resource.parserVersion).toBe('legislative-csv-archive-v2')
      expect(resource.schema).toMatchObject({ alternativeFormats: expect.arrayContaining([expect.stringContaining(`/json/${category}-${year}.json`)]) })
    }
  })
  it('cataloga também links administrativos e de documentação, tratando BOM e linhas inválidas', async () => {
    const year = new Date().getUTCFullYear()
    const plan = await senadoArchiveAdapter.discover(async (url) => ({ fetchedAt: new Date().toISOString(), body: Buffer.from(url.endsWith('/geracsv') ? '\uFEFFnom_categoria;nom_conjunto_dados;txt_url\nAdministrativo;Contratos;https://adm.senado.leg.br/contratos.csv\nLegislativo;Documentação;https://legis.senado.leg.br/api-docs/index.html#Senadores\nLinha inválida\n' : url.endsWith('/ListaLegislatura.json') ? JSON.stringify({ ListaLegislatura: { Legislaturas: { Legislatura: [{ NumeroLegislatura: '57', DataInicio: `${year}-01-01`, DataFim: `${year}-12-31` }] } } }) : '<html><a href="https://legis.senado.leg.br/dadosabertos/arquivos/ListaLegislatura.json">Legislaturas</a></html>') }))
    expect(plan.source.metadata['generalCatalogueResources']).toBe(2)
    expect(plan.source.metadata['incompleteDictionaryRows']).toBe(1)
    expect(plan.resources.some((resource) => resource.name === 'votacoes-2000')).toBe(true)
    expect(plan.resources.some((resource) => resource.name === 'votacoes-1999')).toBe(false)
    expect(plan.catalog?.some((resource) => resource.url === 'https://adm.senado.leg.br/contratos.csv')).toBe(true)
    expect(plan.resources.some((resource) => resource.url === 'https://adm.senado.leg.br/contratos.csv')).toBe(false)
  })
})
