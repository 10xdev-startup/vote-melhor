import { describe, it, expect } from "@jest/globals"
import { filterDatasets } from "@/lib/dataCatalogSearch"
import { CATALOG_FIXTURE } from "./fixtures/dataCatalog"
import type { Dataset } from "@/types/dataCatalog"

function allFiles(datasets: Dataset[]) {
  return datasets.flatMap((dataset) => dataset.editions.flatMap((edition) => edition.files))
}

describe("filterDatasets", () => {
  it("sem termo, devolve o catálogo inteiro", () => {
    expect(filterDatasets(CATALOG_FIXTURE, "   ")).toBe(CATALOG_FIXTURE)
  })

  it("acha por nome de arquivo em todos os exercícios", () => {
    const results = filterDatasets(CATALOG_FIXTURE, "fluxo de caixa")
    const files = allFiles(results)
    expect(files).toHaveLength(3)
    files.forEach((file) => expect(file.name).toBe("Demonstração dos Fluxos de Caixa"))
    // os exercicios continuam navegaveis pelas setas
    expect(results[0]?.editions).toHaveLength(3)
  })

  it("ignora acento e caixa", () => {
    const comAcento = filterDatasets(CATALOG_FIXTURE, "Demonstração")
    const semAcento = filterDatasets(CATALOG_FIXTURE, "demonstracao")
    expect(allFiles(semAcento).map((file) => file.id)).toEqual(allFiles(comAcento).map((file) => file.id))
    expect(semAcento.length).toBeGreaterThan(0)
  })

  it("casando o conjunto, traz todos os arquivos dele", () => {
    const results = filterDatasets(CATALOG_FIXTURE, "receitas próprias")
    expect(results).toHaveLength(1)
    expect(allFiles(results)).toHaveLength(2)
  })

  it("buscar um ano deixa só aquele exercício", () => {
    const results = filterDatasets(CATALOG_FIXTURE, "2024")
    expect(results).toHaveLength(1)
    expect(results[0]?.editions).toHaveLength(1)
    expect(results[0]?.editions[0]?.label).toBe("2024")
  })

  it("cruza arquivo com exercício", () => {
    const results = filterDatasets(CATALOG_FIXTURE, "patrimonial 2023")
    const files = allFiles(results)
    expect(files).toHaveLength(1)
    expect(files[0]?.url).toContain("/2023/")
  })

  it("cai no conjunto inteiro quando o termo só existe na descrição", () => {
    // "Balanço Geral da União" so aparece na descricao do conjunto, em nenhum arquivo.
    const results = filterDatasets(CATALOG_FIXTURE, "balanço geral da união")
    expect(results).toHaveLength(1)
    expect(allFiles(results)).toHaveLength(6)
  })

  it("termo sem correspondência devolve lista vazia", () => {
    expect(filterDatasets(CATALOG_FIXTURE, "votação nominal")).toEqual([])
  })
})
