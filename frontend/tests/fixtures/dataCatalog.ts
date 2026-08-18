import type { Dataset, DatasetEdition, SourceSystem } from "@/types/dataCatalog"

/**
 * Catalogo de mentira, com a MESMA forma do real: um conjunto de serie continua (arquivos
 * tabulares) e um com varios exercicios (relatorios), ambos com preview. O catalogo
 * de verdade agora vive no backend e e testado la — aqui o que se prova e busca e UI.
 */

const ARQUIMEDES: SourceSystem = {
  name: "Arquimedes",
  description: "Sistema interno do Senado, na plataforma SAP.",
  referenceUrl: "https://www12.senado.leg.br/dados-abertos/sobre#fontes",
}

const SIAFI: SourceSystem = {
  name: "SIAFI",
  description: "Sistema Integrado de Administração Financeira do Governo Federal.",
  referenceUrl: "https://www.gov.br/tesouronacional/pt-br/siafi",
}

function demonstracoesEdition(year: number): DatasetEdition {
  return {
    id: `demonstracoes-${year}`,
    label: String(year),
    year,
    updatedAt: `${year}-12-31`,
    files: [
      {
        id: `demonstracoes-${year}-bp`,
        name: "Balanço Patrimonial",
        description: "O que o Senado tem e o que deve no fechamento do exercício.",
        format: "CSV",
        layout: "report",
        url: `https://www12.senado.leg.br/x/${year}/bp.csv`,
        sizeInBytes: 9644,
      },
      {
        id: `demonstracoes-${year}-dfc`,
        name: "Demonstração dos Fluxos de Caixa",
        description: "Movimentação de caixa separada em operacional, de investimento e de financiamento.",
        format: "CSV",
        layout: "report",
        url: `https://www12.senado.leg.br/x/${year}/dfc.csv`,
        sizeInBytes: 5496,
      },
    ],
  }
}

export const CATALOG_FIXTURE: Dataset[] = [
  {
    id: "receitas-proprias",
    title: "Receitas próprias",
    description: "Previsão e arrecadação das receitas próprias do Senado Federal.",
    organ: "Senado Federal",
    group: "Orçamento do Senado",
    sourceSystem: ARQUIMEDES,
    updateFrequency: "Diário",
    maintainer: "Coordenação de Planejamento",
    officialUrl: "https://www12.senado.leg.br/dados-abertos/conjuntos",
    collectedAt: "2026-08-10",
    editions: [
      {
        id: "receitas-serie",
        label: "Desde 2012",
        year: null,
        updatedAt: "2026-08-10",
        files: [
          {
            id: "receitas-csv",
            name: "Receitas próprias (planilha)",
            description: "Uma linha por natureza de receita, com o valor previsto e o arrecadado.",
            format: "CSV",
            layout: "tabular",
            url: "https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/ReceitasSenado.csv",
            sizeInBytes: 226922,
          },
          {
            id: "receitas-json",
            name: "Receitas próprias (JSON)",
            description: "Os mesmos dados da planilha, em JSON.",
            format: "JSON",
            layout: "tabular",
            url: "https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/ReceitasSenadoDadosAbertos.json",
            sizeInBytes: 401511,
          },
        ],
      },
    ],
  },
  {
    id: "demonstracoes-contabeis",
    title: "Demonstrações Contábeis",
    description: "Demonstrações contábeis do exercício, na estrutura do Balanço Geral da União.",
    organ: "Senado Federal",
    group: "Orçamento do Senado",
    sourceSystem: SIAFI,
    updateFrequency: "Anual",
    maintainer: "Secretaria de Finanças",
    officialUrl: "https://www12.senado.leg.br/dados-abertos/conjuntos",
    collectedAt: "2026-08-10",
    editions: [demonstracoesEdition(2023), demonstracoesEdition(2024), demonstracoesEdition(2025)],
  },
]
