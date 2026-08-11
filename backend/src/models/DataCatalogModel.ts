import type { DataFile, Dataset, DatasetEdition, DatasetGovernmentTerm, SourceSystem } from "@/types/dataCatalog"

/**
 * Catalogo curado dos arquivos publicados pelo Senado no grupo "Orcamento do Senado".
 *
 * Curado a mao de proposito: o portal rotula os 40 arquivos apenas como "CSV"/"JSON" e o
 * unico indicio do conteudo e o nome do arquivo, que muda de grafia a cada exercicio
 * (`Balanco Patrimonial 2020.csv`, `BGUBPAnualOrgao2000OrgSup.csv`, `bp.csv` sao o mesmo
 * demonstrativo). Dar nome a isso e o que a pagina entrega.
 *
 * Quando o crawler existir, so este model muda — o contrato exposto pela API continua o mesmo.
 */

const ORCAMENTO_SENADO_URL =
  "https://www12.senado.leg.br/dados-abertos/conjuntos?portal=Administrativo&grupo=orcamento-do-senado"

/** Data em que a pagina oficial foi lida e os links conferidos um a um. */
const COLLECTED_AT = "2026-08-10"

const ORGAN = "Senado Federal"
const GROUP = "Orçamento do Senado"

/**
 * Os sistemas de origem, explicados. O portal publica so a sigla; a definicao vem da fonte
 * oficial de cada um — a do Senado para os sistemas internos dele, a do Tesouro para o SIAFI,
 * que e federal e por isso nao aparece na lista do Senado.
 */
const SIAFI: SourceSystem = {
  name: "SIAFI",
  description:
    "Sistema Integrado de Administração Financeira do Governo Federal. Mantido pelo Tesouro Nacional, é onde toda a União (o Senado incluído) registra execução orçamentária, financeira, patrimonial e contábil.",
  referenceUrl: "https://www.gov.br/tesouronacional/pt-br/siafi",
}

const ARQUIMEDES: SourceSystem = {
  name: "Arquimedes",
  description:
    "Sistema interno do Senado, na plataforma SAP, que monta relatórios gerenciais integrando as bases de vários sistemas da Casa: área administrativa (contratos) e legislativa (proposições em tramitação, normas).",
  referenceUrl: "https://www12.senado.leg.br/dados-abertos/sobre#fontes",
}

const DEMONSTRACOES_BASE =
  "https://www12.senado.leg.br/transparencia/orcamento-e-financas/safin/pdf-demonstracoes-contabeis"

type StatementKey = "bp" | "bo" | "bf" | "dvp" | "dfc" | "dmpl"

type Statement = { key: StatementKey; name: string; description: string }

/** Os seis demonstrativos que se repetem em todo exercicio, em ordem contabil. */
const STATEMENTS: Statement[] = [
  {
    key: "bp",
    name: "Balanço Patrimonial",
    description: "O que o Senado tem (bens e direitos) e o que deve (obrigações) no fechamento do exercício.",
  },
  {
    key: "bo",
    name: "Balanço Orçamentário",
    description: "Compara o orçamento previsto com a receita arrecadada e a despesa executada no exercício.",
  },
  {
    key: "bf",
    name: "Balanço Financeiro",
    description: "Entradas e saídas de recursos no exercício, com o saldo que passa para o ano seguinte.",
  },
  {
    key: "dvp",
    name: "Demonstração das Variações Patrimoniais",
    description: "O que aumentou e o que diminuiu o patrimônio no período, inclusive sem passar pelo caixa.",
  },
  {
    key: "dfc",
    name: "Demonstração dos Fluxos de Caixa",
    description: "Movimentação de caixa separada em operacional, de investimento e de financiamento.",
  },
  {
    key: "dmpl",
    name: "Demonstração das Mutações no Patrimônio Líquido",
    description: "Como cada conta do patrimônio líquido mudou ao longo do exercício.",
  },
]

type StatementFile = { file: string; sizeInBytes: number }

type StatementYear = { year: number; files: Record<StatementKey, StatementFile> }

/**
 * Nome do arquivo e tamanho medidos na coleta, por exercicio. As cinco grafias diferentes
 * que o portal usou para o mesmo demonstrativo estao normalizadas aqui — e so aqui.
 * Ordem crescente: a UI abre no exercicio mais recente.
 */
const STATEMENT_YEARS: StatementYear[] = [
  {
    year: 2020,
    files: {
      bp: { file: "Balanco%20Patrimonial%202020.csv", sizeInBytes: 8942 },
      bo: { file: "Balanco%20Orcamentario%202020.csv", sizeInBytes: 9556 },
      bf: { file: "Balanco%20Financeiro%202020.csv", sizeInBytes: 3894 },
      dvp: { file: "DVP%202020.csv", sizeInBytes: 5113 },
      dfc: { file: "DFC%202020.csv", sizeInBytes: 5113 },
      dmpl: { file: "DMPL%202020.csv", sizeInBytes: 2910 },
    },
  },
  {
    year: 2021,
    files: {
      bp: { file: "BGUBPAnualOrgao2000OrgSup.csv", sizeInBytes: 8793 },
      bo: { file: "BGUBOAnualOrgao2000OrgSup.csv", sizeInBytes: 10082 },
      bf: { file: "BGUBFAnualOrgao2000OrgSup.csv", sizeInBytes: 4072 },
      dvp: { file: "BGUDVPAnualOrgao2000OrgSup.csv", sizeInBytes: 7251 },
      dfc: { file: "BGUDFCAnualOrgao2000OrgSup.csv", sizeInBytes: 5438 },
      dmpl: { file: "BGUDMPLMes12EncerradoOrgao2000OrgSup.csv", sizeInBytes: 3105 },
    },
  },
  {
    year: 2022,
    files: {
      bp: { file: "BGU-BP-Anual-Orgao2000-OrgSup.csv", sizeInBytes: 8866 },
      bo: { file: "BGU-BO-Anual-Orgao2000-OrgSup.csv", sizeInBytes: 10262 },
      bf: { file: "BGU-BF-Anual-Orgao2000-OrgSup.csv", sizeInBytes: 3912 },
      dvp: { file: "BGU-DVP-Anual-Orgao2000-OrgSup.csv", sizeInBytes: 7304 },
      dfc: { file: "BGU-DFC-Anual-Orgao2000-OrgSup.csv", sizeInBytes: 5486 },
      dmpl: { file: "BGU-DMPL-Mes12-Orgao2000-OrgSup.csv", sizeInBytes: 3115 },
    },
  },
  {
    year: 2023,
    files: {
      bp: { file: "bgu-bp-trimestre4-encerrado-orgao2000-orgsup.csv", sizeInBytes: 8889 },
      bo: { file: "bgu-bo-trimestre4-encerrado-orgao2000-orgsup.csv", sizeInBytes: 10316 },
      bf: { file: "bgu-bf-trimestre4-encerrado-orgao2000-orgsup.csv", sizeInBytes: 4468 },
      dvp: { file: "bgu-dvp-trimestre4-encerrado-orgao2000-orgsup.csv", sizeInBytes: 7395 },
      dfc: { file: "bgu-dfc-trimestre4-encerrado-orgao2000-orgsup.csv", sizeInBytes: 5536 },
      dmpl: { file: "bgu-dmpl-mes12-encerrado-orgao2000-orgsup-1.csv", sizeInBytes: 3161 },
    },
  },
  {
    year: 2024,
    files: {
      bp: { file: "bp.csv", sizeInBytes: 9644 },
      bo: { file: "bo.csv", sizeInBytes: 10228 },
      bf: { file: "bf.csv", sizeInBytes: 3885 },
      dvp: { file: "dvp.csv", sizeInBytes: 7373 },
      dfc: { file: "dfc-2024.csv", sizeInBytes: 5496 },
      dmpl: { file: "dmpl.csv", sizeInBytes: 3211 },
    },
  },
  {
    year: 2025,
    files: {
      bp: { file: "bgu-bp-trimestre4-encerrado-orgao2000-orgsup-_1_.csv", sizeInBytes: 14751 },
      bo: { file: "bgu-bo-trimestre4-orgao2000-orgsup.csv", sizeInBytes: 17673 },
      bf: { file: "bgu-bf-trimestre4-orgao2000-orgsup.csv", sizeInBytes: 5358 },
      dvp: { file: "bgu-dvp-trimestre4-orgao2000-orgsup.csv", sizeInBytes: 10003 },
      dfc: { file: "bgu-dfc-trimestre4-orgao2000-orgsup.csv", sizeInBytes: 7718 },
      dmpl: { file: "bgu-dmpl-mes12-orgao2000-orgsup-1.csv", sizeInBytes: 3098 },
    },
  },
]

function buildStatementFiles({ year, files }: StatementYear): DataFile[] {
  return STATEMENTS.map((statement) => {
    const source = files[statement.key]
    return {
      id: `senado-demonstracoes-${year}-${statement.key}`,
      name: statement.name,
      description: statement.description,
      format: "CSV",
      // Relatorio do Tesouro, nao tabela: preambulo institucional + ATIVO/PASSIVO lado a lado.
      layout: "report",
      url: `${DEMONSTRACOES_BASE}/${year}/${source.file}`,
      sizeInBytes: source.sizeInBytes,
    }
  })
}

const DEMONSTRACOES_EDITIONS: DatasetEdition[] = STATEMENT_YEARS.map((entry) => ({
  id: `senado-demonstracoes-contabeis-${entry.year}`,
  label: String(entry.year),
  year: entry.year,
  updatedAt: `${entry.year}-12-31`,
  files: buildStatementFiles(entry),
}))

const ARQUIMEDES_BASE = "https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro"

const SP_TRANSPARENCY_URL = "https://www.transparencia.sp.gov.br/home/despcontratos"
const SP_WEBSERVICE_URL = "https://webservices.fazenda.sp.gov.br/WSTransparencia/TransparenciaServico.asmx"
const SIAFEM_SP: SourceSystem = {
  name: "SIAFEM/SP",
  description:
    "Sistema Integrado de Administração Financeira para Estados e Municípios usado pelo Estado de São Paulo. A Secretaria da Fazenda publica diariamente sua execução orçamentária e financeira pelo Portal da Transparência e por web service.",
  referenceUrl: SP_TRANSPARENCY_URL,
}

const SP_INVESTMENT_EDITIONS: DatasetEdition[] = Array.from({ length: 17 }, (_value, index) => 2010 + index).map((year) => ({
  id: `sp-investimentos-${year}`,
  label: String(year),
  year,
  updatedAt: "2026-08-11",
  files: [
    {
      id: `sp-investimentos-${year}-xml`,
      name: "Investimentos e inversões financeiras por órgão",
      description:
        "Linhas brutas do SIAFEM/SP classificadas nas naturezas 44 (investimentos) e 45 (inversões financeiras), com dotação, empenho, liquidação e pagamento por órgão e elemento de despesa.",
      format: "XML",
      layout: "tabular",
      url: SP_WEBSERVICE_URL,
      sizeInBytes: null,
      sourceQuery: { type: "sp-fazenda-expenses", year, naturePrefixes: ["44", "45"] },
    },
  ],
}))

const SP_GOVERNMENT_TERMS: DatasetGovernmentTerm[] = [
  {
    id: "serra-goldman-2007-2010",
    label: "José Serra / Alberto Goldman",
    period: "2007–2010 · dados disponíveis desde 2010",
    years: [{ year: 2010, governor: "José Serra → Alberto Goldman", transition: true }],
    referenceLabel: "Histórico de governadores — Biblioteca Jurídica de SP",
    referenceUrl: "https://www.bibliotecajuridica.sp.gov.br/discursos-de-posse-dos-governadores/",
  },
  {
    id: "alckmin-2011-2014",
    label: "Geraldo Alckmin",
    period: "2011–2014",
    years: [2011, 2012, 2013, 2014].map((year) => ({ year, governor: "Geraldo Alckmin", transition: false })),
    referenceLabel: "Histórico de governadores — Biblioteca Jurídica de SP",
    referenceUrl: "https://www.bibliotecajuridica.sp.gov.br/discursos-de-posse-dos-governadores/",
  },
  {
    id: "alckmin-franca-2015-2018",
    label: "Geraldo Alckmin / Márcio França",
    period: "2015–2018",
    years: [...[2015, 2016, 2017].map((year) => ({ year, governor: "Geraldo Alckmin", transition: false })), { year: 2018, governor: "Geraldo Alckmin → Márcio França", transition: true }],
    referenceLabel: "Histórico de governadores — Biblioteca Jurídica de SP",
    referenceUrl: "https://www.bibliotecajuridica.sp.gov.br/discursos-de-posse-dos-governadores/",
  },
  {
    id: "doria-garcia-2019-2022",
    label: "João Doria / Rodrigo Garcia",
    period: "2019–2022",
    years: [...[2019, 2020, 2021].map((year) => ({ year, governor: "João Doria", transition: false })), { year: 2022, governor: "João Doria → Rodrigo Garcia", transition: true }],
    referenceLabel: "Histórico de governadores — Biblioteca Jurídica de SP",
    referenceUrl: "https://www.bibliotecajuridica.sp.gov.br/discursos-de-posse-dos-governadores/",
  },
  {
    id: "tarcisio-2023-2026",
    label: "Tarcísio de Freitas",
    period: "2023–2026",
    years: [2023, 2024, 2025, 2026].map((year) => ({ year, governor: "Tarcísio de Freitas", transition: false })),
    referenceLabel: "Posse da gestão 2023–2026 — Alesp",
    referenceUrl: "https://www.al.sp.gov.br/noticia/?id=445244",
  },
]

const DATASETS: Dataset[] = [
  {
    id: "senado-dotacao-e-despesas",
    title: "Dotação autorizada e despesas executadas",
    description:
      "Dotação inicial e final alocada ao Senado nos orçamentos anuais e os valores empenhados, liquidados e pagos à conta desses créditos orçamentários.",
    organ: ORGAN,
    group: GROUP,
    sourceSystem: ARQUIMEDES,
    updateFrequency: "Diário",
    maintainer: "Coordenação de Planejamento e Acompanhamento Orçamentário",
    officialUrl: ORCAMENTO_SENADO_URL,
    collectedAt: COLLECTED_AT,
    editions: [
      {
        id: "senado-dotacao-e-despesas-serie",
        label: "Desde 2013",
        year: null,
        updatedAt: "2026-08-10",
        files: [
          {
            id: "senado-despesas-csv",
            name: "Dotação e despesas executadas (planilha)",
            description:
              "Uma linha por ação orçamentária, com dotação inicial, dotação atualizada, empenhado, liquidado e pago.",
            format: "CSV",
            layout: "tabular",
            url: `${ARQUIMEDES_BASE}/DespesaSenado.csv`,
            sizeInBytes: 224643,
          },
          {
            id: "senado-despesas-json",
            name: "Dotação e despesas executadas (JSON)",
            description: "Os mesmos dados da planilha, em JSON, para consumo direto por programa.",
            format: "JSON",
            layout: "tabular",
            url: `${ARQUIMEDES_BASE}/DespesaSenadoDadosAbertos.json`,
            sizeInBytes: 508820,
          },
        ],
      },
    ],
  },
  {
    id: "senado-receitas-proprias",
    title: "Receitas próprias",
    description: "Previsão e arrecadação das receitas próprias do Senado Federal.",
    organ: ORGAN,
    group: GROUP,
    sourceSystem: ARQUIMEDES,
    updateFrequency: "Diário",
    maintainer: "Coordenação de Planejamento e Acompanhamento Orçamentário",
    officialUrl: ORCAMENTO_SENADO_URL,
    collectedAt: COLLECTED_AT,
    editions: [
      {
        id: "senado-receitas-proprias-serie",
        label: "Desde 2012",
        year: null,
        updatedAt: "2026-08-10",
        files: [
          {
            id: "senado-receitas-csv",
            name: "Receitas próprias (planilha)",
            description: "Uma linha por natureza de receita, com o valor previsto e o valor arrecadado.",
            format: "CSV",
            layout: "tabular",
            url: `${ARQUIMEDES_BASE}/ReceitasSenado.csv`,
            sizeInBytes: 226922,
          },
          {
            id: "senado-receitas-json",
            name: "Receitas próprias (JSON)",
            description: "Os mesmos dados da planilha, em JSON, para consumo direto por programa.",
            format: "JSON",
            layout: "tabular",
            url: `${ARQUIMEDES_BASE}/ReceitasSenadoDadosAbertos.json`,
            sizeInBytes: 401511,
          },
        ],
      },
    ],
  },
  {
    id: "senado-demonstracoes-contabeis",
    title: "Demonstrações Contábeis",
    description:
      "Demonstrações contábeis do exercício, na estrutura do Balanço Geral da União. Descrevem a situação patrimonial, financeira e o desempenho orçamentário do Senado. Os mesmos seis demonstrativos se repetem a cada ano.",
    organ: ORGAN,
    group: GROUP,
    sourceSystem: SIAFI,
    updateFrequency: "Anual",
    maintainer: "Secretaria de Finanças, Orçamento e Contabilidade",
    officialUrl: ORCAMENTO_SENADO_URL,
    collectedAt: COLLECTED_AT,
    editions: DEMONSTRACOES_EDITIONS,
  },
  {
    id: "sp-execucao-investimentos",
    title: "Execução de investimentos do Estado de São Paulo",
    description:
      "Dados brutos da execução do Orçamento Fiscal e da Seguridade Social: investimentos e inversões financeiras por órgão, preservando separadamente dotação, empenho, liquidação e pagamento.",
    organ: "Governo do Estado de São Paulo",
    group: "Execução Orçamentária e Financeira",
    sourceSystem: SIAFEM_SP,
    updateFrequency: "Diário",
    maintainer: "Secretaria da Fazenda e Planejamento",
    officialUrl: SP_TRANSPARENCY_URL,
    collectedAt: "2026-08-11",
    editions: SP_INVESTMENT_EDITIONS,
    governmentTerms: SP_GOVERNMENT_TERMS,
  },
]

/**
 * Model do catalogo (Controller -> Model -> Database). Hoje o dado e curado em memoria; quando
 * o crawler entrar, so o corpo destas funcoes muda.
 */
export const DataCatalogModel = {
  listDatasets(): Dataset[] {
    return DATASETS
  },

  /**
   * Resolve o arquivo pelo id. E o que impede o preview de virar proxy aberto: o backend so
   * busca URL que ele mesmo catalogou, nunca uma que venha da request.
   */
  findFileById(fileId: string): DataFile | undefined {
    for (const dataset of DATASETS) {
      for (const edition of dataset.editions) {
        const file = edition.files.find((candidate) => candidate.id === fileId)
        if (file) return file
      }
    }
    return undefined
  },
}
