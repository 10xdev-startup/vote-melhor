import type { DatasetFiscalRow, DatasetFiscalSeries, DatasetFiscalTerm } from '@/types/dataCatalog'

/** Valor publicado em milhares de reais, com ponto de milhar, convertido para reais. */
function thousandReais(published: string): number {
  return Number(published.replaceAll('.', '')) * 1000
}

const TERMS: DatasetFiscalTerm[] = [
  { id: 'itamar', label: 'Itamar Franco (PMDB)', period: '2000–2002' },
  { id: 'aecio', label: 'Aécio Neves (PSDB)', period: '2003–2009' },
  { id: 'anastasia', label: 'Antonio Anastasia (PSDB)', period: '2010–2013' },
  { id: 'alberto', label: 'Alberto Pinto Coelho (PSDB)', period: '2014' },
  { id: 'pimentel', label: 'Fernando Pimentel (PT)', period: '2015–2018' },
  { id: 'zema-1', label: 'Romeu Zema (Novo)', period: '2019–2022' },
  { id: 'zema-2', label: 'Romeu Zema (Novo)', period: '2023–2025' },
]

function historical(year: number, governor: string, termId: string, netDebt: string, revenue: string, ratio: number, transition = false): DatasetFiscalRow {
  return {
    year,
    governor,
    termId,
    transition,
    consolidatedDebt: null,
    netDebt: thousandReais(netDebt),
    netCurrentRevenue: thousandReais(revenue),
    currentRevenue: null,
    netDebtRatio: ratio,
  }
}

function reported(
  year: number,
  governor: string,
  termId: string,
  consolidatedDebt: number,
  netDebt: number,
  netCurrentRevenue: number,
  currentRevenue: number | null,
  netDebtRatio: number,
  transition = false,
): DatasetFiscalRow {
  return { year, governor, termId, transition, consolidatedDebt, netDebt, netCurrentRevenue, currentRevenue, netDebtRatio }
}

/**
 * Dívida líquida e receita corrente líquida de 2000 a 2013: série do Tesouro
 * (SISTN), posição de 31/12, em milhares de reais.
 * De 2014 em diante: RGF anexo 02 no Siconfi, 3º quadrimestre. 2014 é o saldo
 * do exercício anterior informado no RGF de 2015.
 * Receita corrente arrecadada: RREO anexo 01, 6º bimestre, sem intraorçamentárias.
 */
const ROWS: DatasetFiscalRow[] = [
  historical(2000, 'Itamar Franco', 'itamar', '13.614.394', '9.629.796', 141),
  historical(2001, 'Itamar Franco', 'itamar', '26.757.537', '11.412.858', 234),
  historical(2002, 'Itamar Franco', 'itamar', '32.941.741', '12.542.039', 263),
  historical(2003, 'Aécio Neves', 'aecio', '34.735.247', '14.305.976', 243),
  historical(2004, 'Aécio Neves', 'aecio', '37.464.487', '16.695.979', 224),
  historical(2005, 'Aécio Neves', 'aecio', '39.706.846', '19.550.334', 203),
  historical(2006, 'Aécio Neves', 'aecio', '41.767.078', '22.083.399', 189),
  historical(2007, 'Aécio Neves', 'aecio', '44.692.747', '23.803.678', 188),
  historical(2008, 'Aécio Neves', 'aecio', '51.560.659', '29.242.489', 176),
  historical(2009, 'Aécio Neves', 'aecio', '52.264.415', '29.118.470', 179),
  historical(2010, 'Antonio Anastasia', 'anastasia', '60.499.483', '33.179.152', 182, true),
  historical(2011, 'Antonio Anastasia', 'anastasia', '67.779.833', '37.284.184', 182),
  historical(2012, 'Antonio Anastasia', 'anastasia', '70.461.771', '40.371.093', 175),
  historical(2013, 'Antonio Anastasia', 'anastasia', '79.111.025', '43.141.299', 183),
  reported(2014, 'Alberto Pinto Coelho', 'alberto', 93730879484.66, 85279887534.41, 47644235435.77, null, 179, true),
  reported(2015, 'Fernando Pimentel', 'pimentel', 107383681895.65, 102592255535.23, 51643235767.49, 65542749781.97, 198.66),
  reported(2016, 'Fernando Pimentel', 'pimentel', 113258470146.59, 109124343325.83, 53731469131.32, 68762183783.18, 203.09),
  reported(2017, 'Fernando Pimentel', 'pimentel', 108980291648.96, 102814921151.18, 55173574559.76, 71635602764.11, 186.35),
  reported(2018, 'Fernando Pimentel', 'pimentel', 113818597214.14, 106509252863.25, 56345444787.97, 73790922390.68, 189.03),
  reported(2019, 'Romeu Zema', 'zema-1', 130466981134.02, 122689225818.41, 64068169194.3, 82391566701.49, 191.5),
  reported(2020, 'Romeu Zema', 'zema-1', 140881088370.68, 133034157590.97, 70585665374.16, 89831728716.94, 188.49),
  reported(2021, 'Romeu Zema', 'zema-1', 154382029849.59, 139627969996.34, 82453583803.79, 106727137258.97, 169.38),
  reported(2022, 'Romeu Zema', 'zema-1', 159271134912.8, 143460121619.17, 91405979912.77, 96541001033.87, 156.95),
  reported(2023, 'Romeu Zema', 'zema-2', 174037373999.88, 154911175844.7, 92079439352.23, 97142282463.77, 168.39),
  reported(2024, 'Romeu Zema', 'zema-2', 191713500465.53, 168246208541.47, 103495630620.38, 108463408016.95, 162.59),
  reported(2025, 'Romeu Zema', 'zema-2', 213515242948.53, 187101497500.28, 111739462561.63, 116607690523.6, 167.46),
]

const INDEXER_AT_DECEMBER: Record<number, NonNullable<DatasetFiscalRow['indexer']>> = {
  2020: { inflation: 73.14, exchange: 23.56, floating: 2.39, prefixed: 0.91 },
  2021: { inflation: 68.79, exchange: 22.91, floating: 7.44, prefixed: 0.85 },
  2022: { inflation: 79.53, exchange: 13.60, floating: 6.02, prefixed: 0.85 },
  2023: { inflation: 83.56, exchange: 10.46, floating: 5.37, prefixed: 0.60 },
  2024: { inflation: 84.68, exchange: 10.30, floating: 4.47, prefixed: 0.56 },
  2025: { inflation: 88.44, exchange: 7.49, floating: 3.55, prefixed: 0.52 },
}

export const MINAS_FISCAL_SERIES: DatasetFiscalSeries = {
  terms: TERMS,
  rows: ROWS.map((row) => {
    const indexer = INDEXER_AT_DECEMBER[row.year]
    return indexer ? { ...row, indexer } : row
  }),
  partial: {
    label: 'Até agosto de 2026',
    consolidatedDebt: 217165894197.27,
    netDebt: 173163037552.95,
    netDebtRatio: 147.09,
    currentRevenue: 82687810647.61,
    note: 'Ano em andamento. A dívida é a posição do 2º quadrimestre; a receita corrente é a arrecadada até o 4º bimestre. Não compare com um ano fechado.',
  },
  sources: [
    { label: 'Dívida líquida 2000–2014', url: 'https://www.tesourotransparente.gov.br/ckan/dataset/dcl-estados-2000-2014' },
    { label: 'RGF no Siconfi', url: 'https://apidatalake.tesouro.gov.br/docs/siconfi/' },
    { label: 'Boletins da dívida', url: 'https://www.fazenda.mg.gov.br/tesouro-estadual/divida-publica/boletins-da-divida-publica/' },
  ],
  note: '“Não publicada” não é zero. A receita arrecadada só existe nesse relatório a partir de 2015. Até 2014, o Tesouro guardou a receita líquida, já com o desconto do repasse aos municípios. A dívida consolidada, o saldo bruto, entra em 2014. Os valores são os reais de cada ano, sem correção.',
}
