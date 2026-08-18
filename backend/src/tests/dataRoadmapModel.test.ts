import { describe, expect, it } from '@jest/globals'
import { DataCatalogModel } from '@/models/DataCatalogModel'
import { DataRoadmapModel } from '@/models/DataRoadmapModel'

describe('DataRoadmapModel', () => {
  const sections = DataRoadmapModel.listSections()
  const items = sections.flatMap((section) => section.items)
  const availableItems = items.filter((item) => item.status === 'available')

  it('expõe os status e mantém todo o cardápio', () => {
    expect(DataRoadmapModel.countItems('available')).toBe(4)
    expect(DataRoadmapModel.countItems('mapped')).toBe(22)
    expect(DataRoadmapModel.countItems('discovery')).toBe(0)
    expect(items).toHaveLength(26)
  })

  it('deriva todo item disponível de um conjunto real do catálogo', () => {
    const datasets = new Map(DataCatalogModel.listDatasets().map((dataset) => [dataset.id, dataset]))

    availableItems.forEach((item) => {
      const dataset = datasets.get(item.id)
      if (!dataset) throw new Error(`Dataset ${item.id} não encontrado`)
      expect(item.title).toBe(dataset.title)
      expect(item.description).toBe(dataset.description)
      expect(item.organ).toBe(dataset.organ)
      expect(item.officialUrl).toBe(dataset.officialUrl)
      expect(item.access).toEqual([
        ...new Set(dataset.editions.flatMap((edition) => edition.files.map((file) => file.format))),
      ])
    })
  })

  it('mantém ids únicos, URLs HTTPS e atalhos apenas no que está disponível', () => {
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
    expect(items.every((item) => item.officialUrl.startsWith('https://'))).toBe(true)
    expect(items.flatMap((item) => item.officialSources ?? []).every((source) => source.url.startsWith('https://'))).toBe(true)
    expect(items.filter((item) => item.catalogQuery).every((item) => item.status === 'available')).toBe(true)
    expect(availableItems.every((item) => item.catalogQuery)).toBe(true)
  })

  it('documenta contratos concretos para Ipeadata, tribunais superiores e TCU', () => {
    const mappedFronts = ['economic-indicators', 'higher-courts', 'external-control'].map((id) => items.find((item) => item.id === id))

    expect(mappedFronts.every((item) => item?.status === 'mapped')).toBe(true)
    expect(mappedFronts.every((item) => item && !item.access.includes('A definir'))).toBe(true)
    expect(mappedFronts.map((item) => item?.officialSources?.length ?? 0)).toEqual([1, 3, 2])
  })
})
