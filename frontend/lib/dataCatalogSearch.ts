import type { Dataset, DatasetEdition } from "@/types/dataCatalog"

/**
 * Normaliza para busca tolerante: sem acento e sem caixa. Sem isso, "orcamento" nao acha
 * "Orçamento" — e ninguem digita cedilha numa caixa de busca.
 */
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

/**
 * Filtra o catalogo pelo termo digitado, mantendo o conjunto apenas com os arquivos que
 * casaram. Um conjunto tambem casa inteiro quando o termo bate nos campos dele — buscar
 * "receitas" traz os dois arquivos do conjunto, nao so o que repete a palavra.
 *
 * Casa palavra a palavra (todas precisam aparecer), nao a frase inteira: quem digita
 * "fluxo de caixa" espera achar "Demonstracao dos Fluxos de Caixa", e "balanco 2023"
 * precisa cruzar o nome do arquivo com o exercicio do conjunto.
 */
export function filterDatasets(datasets: Dataset[], query: string): Dataset[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return datasets

  return datasets.reduce<Dataset[]>((matches, dataset) => {
    const title = normalize(dataset.title)

    // Primeiro o match especifico. O titulo do conjunto e o rotulo da edicao entram no
    // haystack do arquivo porque o exercicio nao esta no nome do arquivo: e assim que
    // "patrimonial 2021" acha um arquivo so, e "2023" deixa um exercicio so no seletor.
    const editions = dataset.editions.reduce<DatasetEdition[]>((kept, edition) => {
      const context = `${title} ${normalize(edition.label)}`
      const files = edition.files.filter((file) => {
        const haystack = `${context} ${normalize([file.name, file.description, file.format].join(" "))}`
        return terms.every((term) => haystack.includes(term))
      })

      if (files.length > 0) kept.push({ ...edition, files })
      return kept
    }, [])

    if (editions.length > 0) {
      matches.push({ ...dataset, editions })
      return matches
    }

    // Fallback amplo: o termo so aparece na descricao do conjunto ("Balanço Geral da União",
    // "SIAFI"). Nao ha arquivo especifico a destacar, entao o conjunto volta inteiro.
    const datasetHaystack = normalize(
      [dataset.title, dataset.description, dataset.sourceSystem.name, dataset.updateFrequency].join(" ")
    )
    if (terms.every((term) => datasetHaystack.includes(term))) matches.push(dataset)

    return matches
  }, [])
}
