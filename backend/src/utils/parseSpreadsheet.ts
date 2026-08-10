import * as XLSX from 'xlsx'
import { TextDecoder } from 'node:util'

/**
 * Leitor de planilha usado pelo preview da Fonte de dados.
 *
 * SEGURANCA: o `xlsx@0.18.5` (ultima versao publicada no npm) carrega advisories de
 * Prototype Pollution e ReDoS. A mitigacao aqui e estrutural, nao a versao: este parser so
 * recebe bytes de URL que esta no catalogo do proprio backend
 * (`DataCatalogModel.findFileById`) — nunca upload de usuario nem URL vinda da request.
 * Se um dia entrar upload, essa premissa cai e a dependencia precisa ser revista.
 */

/** Ate onde procurar o cabecalho. Os CSVs do governo comecam com linhas vazias e institucionais. */
const MAX_HEADER_SCAN_ROWS = 25

export class SpreadsheetParseError extends Error {
  constructor(
    public readonly code: 'invalid_file' | 'empty_file',
    message: string
  ) {
    super(message)
    this.name = 'SpreadsheetParseError'
  }
}

export interface ParsedSpreadsheet {
  columns: string[]
  rows: string[][]
  /** Total de registros no arquivo, sem contar o cabecalho. */
  totalRowCount: number
  /** Totais monetarios calculados sobre o arquivo inteiro, indexados pelo nome da coluna. */
  columnTotals: Record<string, number>
  /** `true` quando o arquivo tem mais linhas do que as devolvidas. */
  truncated: boolean
}

export interface ParsedReportMetadata {
  label: string
  value: string
}

export interface ParsedReportRow {
  cells: string[]
  kind: 'section' | 'header' | 'total' | 'data'
}

export interface ParsedFinancialReport {
  title: string
  metadata: ParsedReportMetadata[]
  rows: ParsedReportRow[]
  columnCount: number
  totalRowCount: number
  truncated: boolean
}

// Somar uma coluna exige conhecer sua semantica. Nao tente totalizar todo numero do arquivo:
// ano, mes e codigo de natureza tambem parecem numericos, mas a soma deles nao tem sentido.
const TOTALLED_CURRENCY_COLUMNS = new Set(['Receita Arrecadada'])

function parseBrazilianCurrencyToCents(value: string): number | undefined {
  const compact = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (compact === '') return 0
  if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(compact)) return undefined

  const negative = compact.startsWith('-')
  const unsigned = negative ? compact.slice(1) : compact
  const [integerPart = '0', decimalPart = ''] = unsigned.split(',')
  const units = Number(integerPart.replace(/\./g, ''))
  const cents = Number(decimalPart.padEnd(2, '0'))
  const valueInCents = units * 100 + cents

  if (!Number.isSafeInteger(valueInCents)) return undefined
  return negative ? -valueInCents : valueInCents
}

function buildColumnTotals(columns: string[], rows: string[][]): Record<string, number> {
  const totals: Record<string, number> = {}

  columns.forEach((column, columnIndex) => {
    if (!TOTALLED_CURRENCY_COLUMNS.has(column)) return

    let totalInCents = 0
    for (const row of rows) {
      const valueInCents = parseBrazilianCurrencyToCents(row[columnIndex] ?? '')
      // Se a origem mudar o formato, omita o total em vez de exibir uma soma parcial errada.
      if (valueInCents === undefined) return
      totalInCents += valueInCents
    }
    totals[column] = totalInCents / 100
  })

  return totals
}

/**
 * Decodifica sem depender do que o servidor diz.
 *
 * Os CSVs do Senado vem em encodings diferentes dentro do MESMO sistema — `DespesaSenado.csv`
 * e UTF-8 e `ReceitasSenado.csv` e latin-1, ambos do Arquimedes — e nenhum dos dois declara
 * charset no Content-Type. Tentar UTF-8 em modo estrito e cair pro windows-1252 no erro e o
 * que evita `Ã§` no lugar de `ç`.
 */
function decodeText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(buffer).replace(/^\uFEFF/, '')
  }
}

function toCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell === '')
}

function normalizeLabel(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Acha a linha do cabecalho: a primeira com pelo menos duas celulas preenchidas.
 *
 * `ReceitasSenado.csv` abre com uma linha vazia antes do cabecalho, e os relatorios do
 * Tesouro trazem varias linhas institucionais (`;;;MINISTERIO DA FAZENDA;;;`) — pegar a
 * linha 0 as cegas produziria uma tabela sem nome de coluna.
 */
function findHeaderIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index]
    if (!row) continue
    const filled = row.filter((cell) => cell !== '').length
    if (filled >= 2) return index
  }
  return 0
}

function buildTable(grid: string[][], maxRows: number): ParsedSpreadsheet {
  const headerIndex = findHeaderIndex(grid)
  const header = grid[headerIndex] ?? []
  const columns = header.map((cell, position) => (cell === '' ? `Coluna ${position + 1}` : cell))

  const body = grid.slice(headerIndex + 1).filter((row) => !isEmptyRow(row))
  const rows = body.slice(0, maxRows).map((row) => {
    // Normaliza a largura: linha curta vira celula vazia, e o excedente e cortado, senao
    // a tabela do frontend desalinha.
    const normalized = columns.map((_column, position) => row[position] ?? '')
    return normalized
  })

  return {
    columns,
    rows,
    totalRowCount: body.length,
    columnTotals: buildColumnTotals(columns, body),
    truncated: body.length > rows.length,
  }
}

/**
 * JSON do Arquimedes vem embrulhado: `{ "receitas": [ {...} ] }` — um objeto de chave unica
 * envolvendo o array. Desembrulha isso; se ja for array, usa direto.
 */
function extractRecords(payload: unknown): Record<string, unknown>[] {
  const candidate = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Object.values(payload as Record<string, unknown>).find((value) => Array.isArray(value))
      : undefined

  if (!Array.isArray(candidate)) {
    throw new SpreadsheetParseError('invalid_file', 'JSON sem uma lista de registros para exibir')
  }

  return candidate.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
}

function parseJsonRecords(text: string, maxRows: number): ParsedSpreadsheet {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new SpreadsheetParseError('invalid_file', 'Arquivo JSON invalido')
  }

  const records = extractRecords(payload)
  if (records.length === 0) throw new SpreadsheetParseError('empty_file', 'Arquivo sem registros')

  // Uniao das chaves, preservando a ordem de aparicao: registros do governo omitem campo
  // nulo, entao olhar so o primeiro item perderia coluna.
  const columns: string[] = []
  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!columns.includes(key)) columns.push(key)
    })
  })

  const allRows = records.map((record) => columns.map((column) => toCell(record[column])))
  const rows = allRows.slice(0, maxRows)
  return {
    columns,
    rows,
    totalRowCount: records.length,
    columnTotals: buildColumnTotals(columns, allRows),
    truncated: records.length > rows.length,
  }
}

function readGrid(buffer: Buffer, format: 'CSV' | 'XLSX'): string[][] {
  const isCsv = format === 'CSV'
  let workbook: XLSX.WorkBook
  try {
    // CSV entra como texto (o encoding e nosso, nao do SheetJS) e com `raw: true`, que
    // DESLIGA a inferencia de tipo. Sem isso o SheetJS reinterpreta o conteudo do governo:
    // a data "09/08/26" volta como "9/7/26" e o valor "10800,00" vira 1080000 — erro de 100x,
    // porque ele le a virgula decimal brasileira como separador de milhar. Aqui o dado
    // oficial e a fonte da verdade: o preview mostra exatamente o que esta no arquivo.
    // Ja o .xlsx e binario e carrega tipo de verdade, entao vale a formatacao da propria celula.
    workbook = isCsv
      ? XLSX.read(decodeText(buffer), { type: 'string', dense: true, raw: true })
      : XLSX.read(buffer, { type: 'buffer', dense: true })
  } catch {
    throw new SpreadsheetParseError('invalid_file', 'Nao foi possivel ler a planilha')
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName === undefined ? undefined : workbook.Sheets[sheetName]
  if (!sheet) throw new SpreadsheetParseError('empty_file', 'Planilha sem abas')

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: isCsv, blankrows: true })
  // `dense: true` ainda pode devolver arrays esparsos em CSVs com muitos `;;;;`. Array.map
  // preservaria os buracos como `undefined`; Array.from materializa cada posicao como ''.
  const normalized = grid.map((row) =>
    Array.isArray(row) ? Array.from({ length: row.length }, (_value, index) => toCell(row[index])) : [],
  )
  if (normalized.length === 0) throw new SpreadsheetParseError('empty_file', 'Arquivo vazio')

  return normalized
}

function parseGrid(buffer: Buffer, format: 'CSV' | 'XLSX', maxRows: number): ParsedSpreadsheet {
  return buildTable(readGrid(buffer, format), maxRows)
}

const REPORT_METADATA_LABELS = new Map([
  ['TITULO', 'Título'],
  ['SUBTITULO', 'Entidade'],
  ['ORGAO SUPERIOR', 'Órgão superior'],
  ['EXERCICIO', 'Exercício'],
  ['PERIODO', 'Período'],
  ['EMISSAO', 'Emissão'],
])

function classifyReportRow(cells: string[]): ParsedReportRow['kind'] {
  const filled = cells.filter((cell) => cell !== '')
  const normalized = filled.map(normalizeLabel)
  const first = filled[0] ?? ''
  const firstNormalized = normalized[0] ?? ''
  const hasFinancialValue = filled.some((cell) => cell === '-' || /^-?[\d,]+\.\d{2}$/.test(cell))

  if (filled.length <= 2 && !hasFinancialValue && filled.some((cell) => /[A-Za-zÀ-ÿ]/.test(cell))) {
    return 'section'
  }

  if (
    normalized.some((cell) =>
      ['ESPECIFICACAO', 'PREVISAO INICIAL', 'PREVISAO ATUALIZADA', 'RECEITAS REALIZADAS'].includes(cell),
    ) || (filled.length > 1 && !hasFinancialValue)
  ) {
    return 'header'
  }

  if (
    /^(TOTAL|SALDO|RESULTADO|SUPERAVIT|DEFICIT)/.test(firstNormalized) ||
    (/[A-Za-zÀ-ÿ]/.test(first) && first === first.toLocaleUpperCase('pt-BR'))
  ) {
    return 'total'
  }

  return 'data'
}

/**
 * Le os relatorios contabeis do SIAFI sem misturar metadados com a grade contabil.
 * As planilhas usam muitas colunas vazias como espacadores e mudam essas posicoes entre
 * Receita, Despesa e anexos. Cada linha vira sua sequencia de celulas uteis; titulos de
 * secao recebem `colSpan` no frontend para conservar os blocos lado a lado.
 */
export function parseFinancialReport(
  buffer: Buffer,
  format: Extract<SpreadsheetFormat, 'CSV' | 'XLSX'>,
  maxRows: number,
): ParsedFinancialReport {
  if (buffer.length === 0) throw new SpreadsheetParseError('empty_file', 'Arquivo vazio')
  const grid = readGrid(buffer, format)

  let title = 'Demonstrativo contábil'
  const metadata: ParsedReportMetadata[] = []
  let bodyStart = 0

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex] ?? []
    const unitsCell = row.find((cell) => normalizeLabel(cell) === 'VALORES EM UNIDADES DE REAL')
    if (unitsCell !== undefined) {
      metadata.push({ label: 'Unidade', value: 'Valores em unidades de real' })
      bodyStart = rowIndex + 1
      break
    }

    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cell = row[cellIndex] ?? ''
      const displayLabel = REPORT_METADATA_LABELS.get(normalizeLabel(cell))
      if (!displayLabel) continue
      const value = row.slice(cellIndex + 1).find((candidate) => candidate !== '')
      if (!value) continue
      if (displayLabel === 'Título') title = value
      else metadata.push({ label: displayLabel, value })
      bodyStart = rowIndex + 1
      break
    }
  }

  const body = grid.slice(bodyStart).filter((row) => !isEmptyRow(row))
  if (body.length === 0) throw new SpreadsheetParseError('empty_file', 'Relatório sem linhas contábeis')

  const allRows = body.map((row) => row.filter((cell) => cell !== ''))
  const columnCount = Math.max(...allRows.map((row) => row.length))
  const rows = allRows.slice(0, maxRows).map((cells) => ({ cells, kind: classifyReportRow(cells) }))

  return {
    title,
    metadata,
    rows,
    columnCount,
    totalRowCount: allRows.length,
    truncated: allRows.length > rows.length,
  }
}

/** Formatos que o parser le. Mais amplo que o catalogo de hoje (CSV/JSON) de proposito: as
 * proximas fontes (TSE, Portal da Transparencia) publicam `.xlsx`, e o SheetJS ja esta aqui. */
export type SpreadsheetFormat = 'CSV' | 'JSON' | 'XLSX'

/**
 * Le os bytes de um arquivo do catalogo e devolve as primeiras `maxRows` linhas.
 *
 * `format` vem do catalogo (nao do Content-Type nem da extensao da URL), porque e o dado que
 * a 10xGov ja curou e conferiu.
 */
export function parseSpreadsheet(buffer: Buffer, format: SpreadsheetFormat, maxRows: number): ParsedSpreadsheet {
  if (buffer.length === 0) throw new SpreadsheetParseError('empty_file', 'Arquivo vazio')
  if (format === 'JSON') return parseJsonRecords(decodeText(buffer), maxRows)
  return parseGrid(buffer, format, maxRows)
}
