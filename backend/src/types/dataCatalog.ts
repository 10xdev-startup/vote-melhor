/** Formato em que o orgao publica o arquivo. */
export type DataFileFormat = "CSV" | "JSON"

/**
 * Como o conteudo do arquivo e organizado — nao e capacidade tecnica, e formato.
 *
 * `tabular`: uma linha por registro, com cabecalho. Da pra mostrar como tabela.
 * `report`: relatorio formatado. Os demonstrativos contabeis do Tesouro sao assim —
 * preambulo institucional e balanco de duas colunas lado a lado (ATIVO x PASSIVO). O preview
 * usa um renderer proprio para preservar metadados, secoes e a largura variavel da grade.
 */
export type DataFileLayout = "tabular" | "report"

/**
 * Um arquivo publicado por um orgao oficial — a menor unidade do catalogo.
 *
 * `name` e `description` sao curadoria da 10xGov: o portal de origem rotula todos os
 * arquivos como "CSV" e esconde o conteudo real dentro do nome do arquivo
 * (`BGUBPAnualOrgao2000OrgSup.csv`). `url` continua apontando para o dominio oficial —
 * a 10xGov nunca re-hospeda o arquivo.
 */
export interface DataFile {
  id: string
  name: string
  description: string
  format: DataFileFormat
  layout: DataFileLayout
  url: string
  /** Tamanho em bytes medido na coleta; `null` quando o orgao nao informa. */
  sizeInBytes: number | null
}

/**
 * Uma edicao do conjunto — tipicamente um exercicio.
 *
 * O portal publica cada exercicio como se fosse um conjunto novo, mas os arquivos sao os
 * mesmos seis demonstrativos todo ano. Modelar como edicao deixa a UI navegar por ano em
 * vez de repetir o mesmo conjunto seis vezes. Series continuas tem uma edicao so.
 */
export interface DatasetEdition {
  id: string
  /** Rotulo do seletor, ex.: "2025" ou "Desde 2013". */
  label: string
  /** Exercicio da edicao, ou `null` quando e serie continua. */
  year: number | null
  /** Ultima atualizacao declarada pelo orgao para esta edicao (ISO 8601). */
  updatedAt: string
  files: DataFile[]
}

/**
 * O sistema de onde o dado sai.
 *
 * O portal publica so a sigla ("SIAFI", "Arquimedes"), que nao diz nada a quem chega de
 * fora — e o mesmo problema do arquivo chamado "CSV", um nivel acima. A descricao e
 * descritiva por contrato (o que o sistema e, quem mantem), nunca interpretativa, e
 * `referenceUrl` aponta a pagina oficial que a sustenta.
 */
export interface SourceSystem {
  /** Sigla como o orgao publica, ex.: "SIAFI". */
  name: string
  description: string
  referenceUrl: string
}

/** Conjunto de dados: arquivos que compartilham origem, periodicidade e area responsavel. */
export interface Dataset {
  id: string
  title: string
  description: string
  /** Orgao publicador, ex.: "Senado Federal". */
  organ: string
  /** Grupo dentro do portal do orgao, ex.: "Orcamento do Senado". */
  group: string
  sourceSystem: SourceSystem
  /** Periodicidade declarada pelo orgao, ex.: "Anual". */
  updateFrequency: string
  /** Area responsavel dentro do orgao. */
  maintainer: string
  /** Pagina oficial que sustenta estes metadados — procedencia obrigatoria. */
  officialUrl: string
  /** Data em que a 10xGov leu a pagina oficial (ISO 8601). */
  collectedAt: string
  /** Em ordem cronologica crescente: a UI abre na ultima (mais recente). */
  editions: DatasetEdition[]
}

export interface FilePreviewPagination {
  /** Página atual, começando em 1. */
  page: number
  /** Quantidade máxima de linhas por página. */
  pageSize: number
  /** Total de páginas disponíveis. */
  totalPages: number
}

export interface FilePreviewExactFilter {
  column: string
  operator: "equals"
  value: string
}

export interface FilePreviewRangeFilter {
  column: string
  operator: "range"
  min?: string
  max?: string
}

export type FilePreviewFilter = FilePreviewExactFilter | FilePreviewRangeFilter

export interface FilePreviewFacetOption {
  value: string
  count: number
}

export interface FilePreviewFacet {
  column: string
  options: FilePreviewFacetOption[]
  totalDistinctValues: number
}

/** Página de uma tabela regular, lida na hora a partir da fonte oficial. */
export interface TabularFilePreview extends FilePreviewPagination {
  layout: "tabular"
  fileId: string
  columns: string[]
  rows: string[][]
  /** Linhas devolvidas nesta amostra. */
  rowCount: number
  /** Total de linhas de dados no arquivo, sem contar o cabecalho. */
  totalRowCount: number
  /** Total antes da aplicação dos filtros. */
  unfilteredRowCount: number
  /** Filtros exatos aplicados antes da paginação. */
  appliedFilters: FilePreviewFilter[]
  /** Todos os valores distintos de cada coluna, com suas contagens. */
  facets: FilePreviewFacet[]
  /** Totais monetarios do arquivo inteiro, indexados pelo nome da coluna. */
  columnTotals: Record<string, number>
  /** `true` quando o arquivo tem mais linhas do que as devolvidas. */
  truncated: boolean
}

export interface ReportPreviewMetadata {
  label: string
  value: string
}

export interface ReportPreviewRow {
  cells: string[]
  kind: "section" | "header" | "total" | "data"
}

/** Demonstrativo contabil com metadados e grade de largura variavel. */
export interface ReportFilePreview extends FilePreviewPagination {
  layout: "report"
  fileId: string
  title: string
  metadata: ReportPreviewMetadata[]
  rows: ReportPreviewRow[]
  columnCount: number
  rowCount: number
  totalRowCount: number
  truncated: boolean
}

export type FilePreview = TabularFilePreview | ReportFilePreview
