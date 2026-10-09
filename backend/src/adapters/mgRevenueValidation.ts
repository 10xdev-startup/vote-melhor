import type { OfficialRow, DimensionLink } from '@/utils/officialData'

export const PARSER_VERSION = 'mg-revenue-v1'
export const REVENUE_FIELDS = ['id_tempo', 'id_unidade_orc', 'id_origem', 'id_especie', 'id_desdobramento_1', 'id_desdobramento_2', 'id_desdobramento_3', 'id_tipo', 'id_item', 'id_subitem', 'id_fonte', 'cd_fonte', 'cd_classificacao_rec', 'ano_particao', 'vr_efetivado'] as const

export function normalizeRevenueRow(row: OfficialRow, rowNumber: number) {
  const year = Number(row['ano_particao'])
  if (!/^\d{4}$/.test(row['ano_particao'] ?? '') || year < 2018 || year > new Date().getUTCFullYear()) throw new Error(`Linha ${rowNumber}: exercício inválido`)
  const amount = row['vr_efetivado'] ?? ''
  if (!/^-?\d{1,20}(?:\.\d{1,2})?$/.test(amount)) throw new Error(`Linha ${rowNumber}: valor monetário inválido`)
  for (const field of REVENUE_FIELDS.filter((name) => name.startsWith('id_'))) {
    if (!/^\d+$/.test(row[field] ?? '')) throw new Error(`Linha ${rowNumber}: identificador inválido ${field}`)
  }
  if (!row['cd_fonte'] || !row['cd_classificacao_rec']) throw new Error(`Linha ${rowNumber}: classificação ausente`)
  const [integer, fraction = ''] = amount.split('.')
  return { row_number: rowNumber, year, time_id: row['id_tempo'], budget_unit_id: row['id_unidade_orc'], source_code: row['cd_fonte'], classification_code: row['cd_classificacao_rec'], amount: `${integer}.${fraction.padEnd(2, '0')}`, raw: row }
}

export function validateDimensionLinks(rows: OfficialRow[], links: DimensionLink[], dimensions: Map<string, OfficialRow[]>): void {
  for (const link of links) {
    const values = dimensions.get(link.reference.resource)
    if (!values || link.fields.length !== 1 || link.reference.fields.length !== 1) throw new Error('Contrato de dimensão não suportado')
    const keyField = link.reference.fields[0]!
    const index = new Map<string, OfficialRow>()
    for (const value of values) {
      const key = value[keyField]
      if (!key || index.has(key)) throw new Error(`Chave ausente ou duplicada em ${link.reference.resource}`)
      index.set(key, value)
    }
    for (const row of rows) {
      const match = index.get(row[link.fields[0]!] ?? '')
      if (!match) throw new Error(`Chave de dimensão ausente em ${link.reference.resource}`)
      if (link.reference.resource === 'dm_tempo_mensal' && match['ano'] !== row['ano_particao']) throw new Error('Dimensão temporal difere do período do fato')
    }
  }
}
