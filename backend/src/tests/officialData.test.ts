import { gzipSync } from 'node:zlib'
import { describe, expect, it } from '@jest/globals'
import { parseOfficialCsv, officialErrorMessage } from '@/utils/officialData'
import { normalizeRevenueRow, validateDimensionLinks, REVENUE_FIELDS } from '@/adapters/mgRevenueValidation'

const schema = { fields: REVENUE_FIELDS.map((name) => ({ name })) }
const revenue = { id_tempo: '1', id_unidade_orc: '2', id_origem: '3', id_especie: '4', id_desdobramento_1: '5', id_desdobramento_2: '6', id_desdobramento_3: '7', id_tipo: '8', id_item: '9', id_subitem: '10', id_fonte: '11', cd_fonte: '001', cd_classificacao_rec: '001234', ano_particao: '2025', vr_efetivado: '-9007199254740993.01' }
const csv = (body: string) => gzipSync(Buffer.from(`\uFEFF${REVENUE_FIELDS.join(';')}\r\n${body}\r\n`))

describe('officialData: contratos de importação', () => {
  it('registra erros de conteúdo binário sem caracteres NUL proibidos pelo Postgres', () => {
    expect(officialErrorMessage(new Error('Arquivo inválido: PK\u0000\u0000'))).toBe('Arquivo inválido: PK')
    expect(officialErrorMessage({ message: 'Erro\u0000 de origem' })).toBe('Erro de origem')
  })
  it('preserva códigos e valores monetários sem arredondamento de Number', () => {
    const rows = parseOfficialCsv(csv(REVENUE_FIELDS.map((field) => revenue[field]).join(';')), schema)
    expect(rows[0]?.['cd_fonte']).toBe('001')
    expect(normalizeRevenueRow(rows[0]!, 1)).toMatchObject({ amount: '-9007199254740993.01', year: 2025, source_code: '001', raw: revenue })
  })
  it('recusa arquivo sem registros em vez de publicar zero', () => {
    expect(() => parseOfficialCsv(csv(''), schema)).toThrow('sem registros')
  })
  it('recusa mudança de schema, linha truncada, gzip inválido e expansão excessiva', () => {
    expect(() => parseOfficialCsv(gzipSync(Buffer.from('outro\n1')), schema)).toThrow('schema')
    expect(() => parseOfficialCsv(csv('1;2'), schema)).toThrow('colunas')
    expect(() => parseOfficialCsv(Buffer.from('HTML'), schema)).toThrow()
    expect(() => parseOfficialCsv(csv('x'.repeat(2000)), schema, 100)).toThrow()
  })
  it('recusa valores vazios, casas decimais extras e exercício fora da cobertura', () => {
    for (const amount of ['', 'NaN', '1.001', '1e8', '1,00']) {
      expect(() => normalizeRevenueRow({ ...revenue, vr_efetivado: amount }, 1)).toThrow('monetário')
    }
    expect(() => normalizeRevenueRow({ ...revenue, ano_particao: '2017' }, 1)).toThrow('exercício')
    expect(normalizeRevenueRow({ ...revenue, vr_efetivado: '0' }, 1).amount).toBe('0.00')
  })
  it('valida chaves, duplicatas e períodos das dimensões sem inferir datas do id', () => {
    const links = [{ fields: ['id_tempo'], reference: { fields: ['id_tempo'], resource: 'dm_tempo_mensal' } }]
    expect(() => validateDimensionLinks([revenue], links, new Map([['dm_tempo_mensal', [{ id_tempo: '1', ano: '2025' }]]]))).not.toThrow()
    expect(() => validateDimensionLinks([revenue], links, new Map([['dm_tempo_mensal', [{ id_tempo: '1', ano: '2024' }]]]))).toThrow('período')
    expect(() => validateDimensionLinks([revenue], links, new Map([['dm_tempo_mensal', [{ id_tempo: '2', ano: '2025' }]]]))).toThrow('ausente')
    expect(() => validateDimensionLinks([revenue], links, new Map([['dm_tempo_mensal', [{ id_tempo: '1' }, { id_tempo: '1' }]]]))).toThrow('duplicada')
  })
})
