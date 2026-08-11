import { describe, it, expect } from '@jest/globals'
import { parseFinancialReport, parseSpreadsheet, SpreadsheetParseError } from '@/utils/parseSpreadsheet'

/**
 * Fixtures montadas por bytes, sem rede: o que se prova aqui e que o conteudo do governo
 * chega na tela EXATAMENTE como o orgao publicou — encoding e valor.
 */
function latin1(text: string): Buffer {
  return Buffer.from(text, 'latin1')
}

function utf8(text: string): Buffer {
  return Buffer.from(text, 'utf-8')
}

// Estrutura real do ReceitasSenado.csv: linha vazia antes do cabecalho, `;` e aspas.
const CSV_RECEITAS = [
  '',
  '"Data da carga";"Órgão Superior";"Receita Anual Prevista";"Receita Arrecadada"',
  '"09/08/26";"02000 - SENADO FEDERAL";"0,00";"2483,60"',
  '"09/08/26";"02000 - SENADO FEDERAL";"10800,00";"11000,00"',
].join('\n')

describe('parseSpreadsheet — CSV', () => {
  it('preserva acento em arquivo latin-1', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 10)
    expect(out.columns).toContain('Órgão Superior')
  })

  it('preserva acento em arquivo UTF-8', () => {
    const csv = utf8('"Exercício";"Ação (código)"\n"2026";"00PW"')
    const out = parseSpreadsheet(csv, 'CSV', 10)
    expect(out.columns).toEqual(['Exercício', 'Ação (código)'])
  })

  it('não reinterpreta data nem valor monetário do arquivo original', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 10)

    // Sem `raw: true` no SheetJS, "09/08/26" volta como "9/7/26" (formato americano)
    // e "10800,00" vira 1080000 — a virgula decimal lida como separador de milhar.
    expect(out.rows[0]?.[0]).toBe('09/08/26')
    expect(out.rows[1]?.[2]).toBe('10800,00')
    expect(out.rows[0]?.[3]).toBe('2483,60')
  })

  it('soma a receita arrecadada sobre todas as linhas, mesmo quando o preview e cortado', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 1)
    expect(out.rows).toHaveLength(1)
    expect(out.columnTotals['Receita Arrecadada']).toBe(13483.6)
  })

  it('acha o cabeçalho depois da linha vazia inicial', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 10)
    expect(out.columns[0]).toBe('Data da carga')
    expect(out.rows).toHaveLength(2)
  })

  it('pula o preâmbulo institucional dos relatórios do Tesouro', () => {
    // Os demonstrativos contabeis abrem com linhas `;;;;` e cabecalho do orgao.
    const csv = [';;;;', ';;;MINISTÉRIO DA FAZENDA;;;', ';;;;', ';ATIVO;;PASSIVO;', ';100,00;;200,00;'].join('\n')
    const out = parseSpreadsheet(latin1(csv), 'CSV', 10)
    expect(out.columns).toContain('ATIVO')
    expect(out.columns).toContain('PASSIVO')
  })

  it('marca truncated quando corta linhas', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 1)
    expect(out.rows).toHaveLength(1)
    expect(out.totalRowCount).toBe(2)
    expect(out.truncated).toBe(true)
  })

  it('devolve o recorte solicitado sem perder total e totais monetários', () => {
    const out = parseSpreadsheet(latin1(CSV_RECEITAS), 'CSV', 1, 1)
    expect(out.rows).toEqual([['09/08/26', '02000 - SENADO FEDERAL', '10800,00', '11000,00']])
    expect(out.totalRowCount).toBe(2)
    expect(out.columnTotals['Receita Arrecadada']).toBe(13483.6)
    expect(out.truncated).toBe(false)
  })

  it('filtra qualquer coluna antes de paginar e recalcula totais e facetas', () => {
    const csv = [
      '"Exercício Financeiro (Lan-Ef)";"Ação (nome)";"Valor Pago"',
      '"2026";"AÇÃO A";"10800,00"',
      '"2026";"AÇÃO A";"200,00"',
      '"2025";"AÇÃO B";"5000,00"',
    ].join('\n')
    const out = parseSpreadsheet(utf8(csv), 'CSV', 20, 0, [{ column: 'Exercício Financeiro (Lan-Ef)', operator: 'equals', value: '2026' }])

    expect(out.rows).toHaveLength(2)
    expect(out.totalRowCount).toBe(2)
    expect(out.unfilteredRowCount).toBe(3)
    expect(out.columnTotals['Valor Pago']).toBe(11000)
    expect(out.facets.find((facet) => facet.column === 'Exercício Financeiro (Lan-Ef)')?.options).toEqual([
      { value: '2026', count: 2 },
      { value: '2025', count: 1 },
    ])
    expect(out.facets.find((facet) => facet.column === 'Ação (nome)')?.options).toEqual([{ value: 'AÇÃO A', count: 2 }])
  })

  it('combina intervalo financeiro inclusivo com filtros exatos', () => {
    const csv = [
      '"Exercício";"Ação";"Valor Pago"',
      '"2026";"A";"5000,00"',
      '"2026";"B";"10800,00"',
      '"2026";"C";"12000,00"',
      '"2025";"D";"10500,00"',
    ].join('\n')
    const out = parseSpreadsheet(utf8(csv), 'CSV', 20, 0, [
      { column: 'Exercício', operator: 'equals', value: '2026' },
      { column: 'Valor Pago', operator: 'range', min: '10.000,00', max: '11.000,00' },
    ])

    expect(out.rows).toEqual([['2026', 'B', '10800,00']])
    expect(out.columnTotals['Valor Pago']).toBe(10800)
    expect(out.appliedFilters).toHaveLength(2)
  })

  it('não limita a quantidade de valores distintos sugeridos por coluna', () => {
    const rows = Array.from({ length: 105 }, (_value, index) => `"${index}";"Valor ${index}"`)
    const out = parseSpreadsheet(utf8(['"id";"nome"', ...rows].join('\n')), 'CSV', 20)
    expect(out.facets.find((facet) => facet.column === 'nome')?.options).toHaveLength(105)
  })

  it('normaliza a largura das linhas pela quantidade de colunas', () => {
    const csv = '"a";"b";"c"\n"1";"2"'
    const out = parseSpreadsheet(utf8(csv), 'CSV', 10)
    expect(out.rows[0]).toEqual(['1', '2', ''])
  })

  it('recusa arquivo vazio', () => {
    expect(() => parseSpreadsheet(Buffer.alloc(0), 'CSV', 10)).toThrow(SpreadsheetParseError)
  })
})

describe('parseSpreadsheet — JSON', () => {
  it('desembrulha o array que vem dentro do objeto do Arquimedes', () => {
    const json = utf8(JSON.stringify({ receitas: [{ ano: '2026', valor: 10 }] }))
    const out = parseSpreadsheet(json, 'JSON', 10)
    expect(out.columns).toEqual(['ano', 'valor'])
    expect(out.rows[0]).toEqual(['2026', '10'])
  })

  it('aceita array na raiz', () => {
    const out = parseSpreadsheet(utf8(JSON.stringify([{ a: 1 }])), 'JSON', 10)
    expect(out.columns).toEqual(['a'])
    expect(out.totalRowCount).toBe(1)
  })

  it('junta as chaves de todos os registros, não só do primeiro', () => {
    // Registros do governo omitem campo nulo: olhar so o item 0 perderia coluna.
    const json = utf8(JSON.stringify([{ a: 1 }, { a: 2, b: 3 }]))
    const out = parseSpreadsheet(json, 'JSON', 10)
    expect(out.columns).toEqual(['a', 'b'])
    expect(out.rows[0]).toEqual(['1', ''])
  })

  it('recusa JSON sem lista de registros', () => {
    expect(() => parseSpreadsheet(utf8('{"total":3}'), 'JSON', 10)).toThrow(SpreadsheetParseError)
  })
})

describe('parseFinancialReport — demonstrativo contábil', () => {
  const report = [
    ['', 'TITULO', '', '', '', 'BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS'].join(';'),
    ['', 'ORGÃO SUPERIOR', '', '', '', '2000 - SENADO FEDERAL'].join(';'),
    ['', 'EXERCÍCIO', '', '', '', '2025'].join(';'),
    ['', 'VALORES EM UNIDADES DE REAL'].join(';'),
    '',
    ['', 'ATIVO', '', '', '', 'PASSIVO'].join(';'),
    ['', 'ESPECIFICAÇÃO', '', '2025', '', 'ESPECIFICAÇÃO', '', '2025'].join(';'),
    ['', 'Caixa e Equivalentes de Caixa', '', '1,300,705,195.95', '', 'Obrigações', '', '255,493,108.07'].join(';'),
  ].join('\n')

  it('separa metadados e preserva a posição relativa de Ativo e Passivo', () => {
    const out = parseFinancialReport(utf8(report), 'CSV', 10)

    expect(out.title).toBe('BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS')
    expect(out.metadata).toContainEqual({ label: 'Exercício', value: '2025' })
    expect(out.metadata).toContainEqual({ label: 'Unidade', value: 'Valores em unidades de real' })
    expect(out.rows[0]?.cells).toEqual(['ATIVO', 'PASSIVO'])
    expect(out.rows[2]?.cells).toEqual([
      'Caixa e Equivalentes de Caixa',
      '1,300,705,195.95',
      'Obrigações',
      '255,493,108.07',
    ])
  })

  it('informa o total de linhas mesmo quando o relatório é cortado', () => {
    const out = parseFinancialReport(utf8(report), 'CSV', 1)
    expect(out.rows).toHaveLength(1)
    expect(out.totalRowCount).toBe(3)
    expect(out.truncated).toBe(true)
  })

  it('pagina as linhas do relatório preservando os metadados', () => {
    const out = parseFinancialReport(utf8(report), 'CSV', 1, 1)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0]?.cells).toContain('ESPECIFICAÇÃO')
    expect(out.title).toBe('BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS')
    expect(out.totalRowCount).toBe(3)
  })
})
