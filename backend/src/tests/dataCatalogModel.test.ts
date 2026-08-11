import { describe, it, expect } from '@jest/globals'
import { DataCatalogModel } from '@/models/DataCatalogModel'

const catalog = DataCatalogModel.listDatasets()
const allFiles = catalog.flatMap((dataset) => dataset.editions.flatMap((edition) => edition.files))

// O catalogo e curado a mao: o risco e id repetido, url fora do dominio oficial e arquivo
// perdendo o nome legivel — que e o motivo da pagina existir.
describe('DataCatalogModel', () => {
  it('agrupa os arquivos em 4 conjuntos, com os exercícios como edições', () => {
    expect(catalog).toHaveLength(4)
    expect(allFiles).toHaveLength(57)

    const demonstracoes = catalog.find((dataset) => dataset.id === 'senado-demonstracoes-contabeis')
    expect(demonstracoes?.editions).toHaveLength(6)
    expect(catalog.find((dataset) => dataset.id === 'sp-execucao-investimentos')?.editions).toHaveLength(17)
  })

  it('marca como tabulares os arquivos do Arquimedes e as consultas da Fazenda', () => {
    const tabular = allFiles.filter((file) => file.layout === 'tabular')
    expect(tabular).toHaveLength(21)
    expect(tabular.filter((file) => file.url.includes('Arquimedes'))).toHaveLength(4)
    expect(tabular.filter((file) => file.sourceQuery?.type === 'sp-fazenda-expenses')).toHaveLength(17)

    // Os 36 demonstrativos contabeis sao relatorio do Tesouro, nao tabela.
    expect(allFiles.filter((file) => file.layout === 'report')).toHaveLength(36)
  })

  it('não repete id de conjunto, de edição nem de arquivo', () => {
    const datasetIds = catalog.map((dataset) => dataset.id)
    const editionIds = catalog.flatMap((dataset) => dataset.editions.map((edition) => edition.id))
    const fileIds = allFiles.map((file) => file.id)
    expect(new Set(datasetIds).size).toBe(datasetIds.length)
    expect(new Set(editionIds).size).toBe(editionIds.length)
    expect(new Set(fileIds).size).toBe(fileIds.length)
  })

  it('aponta todo arquivo para um domínio oficial do órgão publicador', () => {
    allFiles.forEach((file) => {
      expect(file.url).toMatch(/^https:\/\/(www12\.senado\.leg\.br|www\.senado\.gov\.br|webservices\.fazenda\.sp\.gov\.br)\//)
    })
  })

  it('dá nome e descrição a todo arquivo', () => {
    allFiles.forEach((file) => {
      expect(file.name.trim().length).toBeGreaterThan(0)
      expect(file.description.trim().length).toBeGreaterThan(0)
      // o nome curado nunca pode ser o nome do arquivo cru do portal
      expect(file.name).not.toMatch(/\.(csv|json)$/i)
    })
  })

  it('explica o sistema de origem e cita a página oficial que sustenta a definição', () => {
    const systems = new Map(catalog.map((dataset) => [dataset.sourceSystem.name, dataset.sourceSystem]))
    expect([...systems.keys()].sort()).toEqual(['Arquimedes', 'SIAFEM/SP', 'SIAFI'])
    expect(systems.get('SIAFI')?.referenceUrl).toContain('tesouronacional')
    expect(systems.get('Arquimedes')?.referenceUrl).toContain('senado.leg.br')
    expect(systems.get('SIAFEM/SP')?.referenceUrl).toContain('transparencia.sp.gov.br')
  })

  it('documenta os mandatos e os anos de transição da série paulista', () => {
    const terms = catalog.find((dataset) => dataset.id === 'sp-execucao-investimentos')?.governmentTerms
    expect(terms?.flatMap((term) => term.years.map((item) => item.year))).toEqual(Array.from({ length: 17 }, (_value, index) => 2010 + index))
    expect(terms?.flatMap((term) => term.years).filter((item) => item.transition).map((item) => item.year)).toEqual([2010, 2018, 2022])
    expect(terms?.every((term) => term.referenceUrl.startsWith('https://'))).toBe(true)
  })

  describe('findFileById', () => {
    // E o que impede o preview de virar proxy aberto: so URL que o proprio backend catalogou.
    it('resolve um arquivo conhecido', () => {
      const file = DataCatalogModel.findFileById('senado-receitas-csv')
      expect(file?.url).toBe('https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/ReceitasSenado.csv')
      expect(file?.layout).toBe('tabular')
    })

    it('acha arquivo dentro de qualquer edição, não só da primeira', () => {
      expect(DataCatalogModel.findFileById('senado-demonstracoes-2020-bp')?.url).toContain('/2020/')
      expect(DataCatalogModel.findFileById('senado-demonstracoes-2025-bp')?.url).toContain('/2025/')
    })

    it('devolve undefined para id desconhecido', () => {
      expect(DataCatalogModel.findFileById('nao-existe')).toBeUndefined()
    })

    it('resolve a consulta parametrizada da Fazenda pelo exercício', () => {
      expect(DataCatalogModel.findFileById('sp-investimentos-2024-xml')?.sourceQuery).toEqual({ type: 'sp-fazenda-expenses', year: 2024, naturePrefixes: ['44', '45'] })
    })
  })
})
