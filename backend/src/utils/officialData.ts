import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import * as XLSX from 'xlsx'

export const ORIGINAL_MAX_BYTES = 30 * 1024 * 1024
export type OfficialRow = Record<string, string>
export interface OfficialSchema { fields: { name: string }[]; primaryKey?: string[]; foreignKeys?: DimensionLink[] }
export interface DimensionLink { fields: string[]; reference: { fields: string[]; resource: string } }

export function sha256(body: Buffer | string): string {
  return createHash('sha256').update(body).digest('hex')
}

/** Postgres não aceita NUL em text/jsonb; erros de JSON podem citar bytes de um ZIP. */
export function officialErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Falha de consulta'
  return message.split('\0').join('').slice(0, 1000)
}

/** raw:true impede que o leitor CSV converta códigos/decimais para Number ou Date. */
export function parseOfficialCsv(body: Buffer, schema: OfficialSchema, maxOutputBytes = 50 * 1024 * 1024): OfficialRow[] {
  const text = gunzipSync(body, { maxOutputLength: maxOutputBytes }).toString('utf8').replace(/^\uFEFF/, '')
  const workbook = XLSX.read(text, { type: 'string', raw: true, FS: ';' })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) throw new Error('CSV sem planilha')
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false })
  const header = matrix.shift() ?? []
  const expected = schema.fields.map((field) => field.name)
  if (header.length !== expected.length || header.some((field, index) => field !== expected[index])) throw new Error('Cabeçalho difere do schema oficial')
  if (!matrix.length) throw new Error('Arquivo sem registros: não publicar como zero')
  return matrix.map((cells, index) => {
    if (cells.length !== header.length || cells.some((cell) => typeof cell !== 'string')) throw new Error(`Linha ${index + 2}: colunas inválidas`)
    const row = Object.fromEntries(header.map((name, column) => [name, cells[column] ?? '']))
    // O preenchimento defval do XLSX precisa ser distinguido de linha CSV truncada.
    if (expected.some((name) => name.startsWith('id_') && !row[name])) throw new Error(`Linha ${index + 2}: colunas obrigatórias vazias`)
    return row
  })
}
