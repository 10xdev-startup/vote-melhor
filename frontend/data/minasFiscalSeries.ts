// Série oficial consultada em 10/10/2026 no Siconfi (Tesouro Nacional), ente 31.
// Dívida e receita corrente líquida: RGF, anexo 02, 3º quadrimestre (posição de 31/12).
// 2014 é o saldo do exercício anterior informado no RGF de 2015, não um relatório de 2014.
// Receitas correntes: RREO, anexo 01, 6º bimestre, coluna "Até o Bimestre", sem intraorçamentárias.
// De 2020 em diante, o percentual oficial da dívida líquida usa a RCL ajustada.
// A diferença para a RCL cheia ficou abaixo de 0,1 ponto percentual nos anos desta série.

export const MINAS_FISCAL_CONSULTED_AT = '2026-10-10'

export const OFFICIAL_MINAS_TRAILS = new Set(['contas-minas', 'receitas-minas', 'divida-minas'])

export interface MinasFiscalYear {
  year: number
  consolidatedDebt: number
  netDebt: number
  netCurrentRevenue: number
  /** Percentual oficial da dívida líquida sobre a RCL. 2014 é calculado pelas duas linhas do mesmo relatório. */
  netDebtRatio: number
  currentRevenue: number | null
  taxes: number | null
  transfers: number | null
  contributions: number | null
  patrimonial: number | null
}

export const MINAS_FISCAL_SERIES: MinasFiscalYear[] = [
  { year: 2014, consolidatedDebt: 93730879484.66, netDebt: 85279887534.41, netCurrentRevenue: 47644235435.77, netDebtRatio: 178.997, currentRevenue: null, taxes: null, transfers: null, contributions: null, patrimonial: null },
  { year: 2015, consolidatedDebt: 107383681895.65, netDebt: 102592255535.23, netCurrentRevenue: 51643235767.49, netDebtRatio: 198.66, currentRevenue: 65542749781.97, taxes: 41869413186.32, transfers: 12291195514.02, contributions: 2868718423.49, patrimonial: 1116308240.55 },
  { year: 2016, consolidatedDebt: 113258470146.59, netDebt: 109124343325.83, netCurrentRevenue: 53731469131.32, netDebtRatio: 203.09, currentRevenue: 68762183783.18, taxes: 46272466724.99, transfers: 13556973186.51, contributions: 2998887293.65, patrimonial: 2301698256.54 },
  { year: 2017, consolidatedDebt: 108980291648.96, netDebt: 102814921151.18, netCurrentRevenue: 55173574559.76, netDebtRatio: 186.35, currentRevenue: 71635602764.11, taxes: 50666375213.9, transfers: 13384550706.35, contributions: 3044358463.15, patrimonial: 974954028.92 },
  { year: 2018, consolidatedDebt: 113818597214.14, netDebt: 106509252863.25, netCurrentRevenue: 56345444787.97, netDebtRatio: 189.03, currentRevenue: 73790922390.68, taxes: 55367606816.85, transfers: 11561481870.71, contributions: 3486359402.56, patrimonial: 1389365718 },
  { year: 2019, consolidatedDebt: 130466981134.02, netDebt: 122689225818.41, netCurrentRevenue: 64068169194.3, netDebtRatio: 191.5, currentRevenue: 82391566701.49, taxes: 58712742553.53, transfers: 14798597252.23, contributions: 3328938111.91, patrimonial: 2511040053.77 },
  { year: 2020, consolidatedDebt: 140881088370.68, netDebt: 133034157590.97, netCurrentRevenue: 70585665374.16, netDebtRatio: 188.49, currentRevenue: 89831728716.94, taxes: 60034021870.83, transfers: 19352543230.54, contributions: 3828860907.52, patrimonial: 1908216519.16 },
  { year: 2021, consolidatedDebt: 154382029849.59, netDebt: 139627969996.34, netCurrentRevenue: 82453583803.79, netDebtRatio: 169.38, currentRevenue: 106727137258.97, taxes: 74436461424.02, transfers: 19584019936.5, contributions: 4716269384.21, patrimonial: 4928045202.48 },
  { year: 2022, consolidatedDebt: 159271134912.8, netDebt: 143460121619.17, netCurrentRevenue: 91405979912.77, netDebtRatio: 156.95, currentRevenue: 96541001033.87, taxes: 58605888317.11, transfers: 24112124225.88, contributions: 5347496803.69, patrimonial: 5372765797.56 },
  { year: 2023, consolidatedDebt: 174037373999.88, netDebt: 154911175844.7, netCurrentRevenue: 92079439352.23, netDebtRatio: 168.39, currentRevenue: 97142282463.77, taxes: 60992435414.02, transfers: 21092604386.62, contributions: 5864793960.39, patrimonial: 6144521935.38 },
  { year: 2024, consolidatedDebt: 191713500465.53, netDebt: 168246208541.47, netCurrentRevenue: 103495630620.38, netDebtRatio: 162.59, currentRevenue: 108463408016.95, taxes: 68193292372.37, transfers: 23599282356.37, contributions: 5894674691.13, patrimonial: 7090489603.22 },
  { year: 2025, consolidatedDebt: 213515242948.53, netDebt: 187101497500.28, netCurrentRevenue: 111739462561.63, netDebtRatio: 167.46, currentRevenue: 116607690523.6, taxes: 73428958984.06, transfers: 24265036018.35, contributions: 6302304614.1, patrimonial: 8339593246.49 },
]

/** Posição até o 2º quadrimestre de 2026 (agosto). Não é ano fechado. */
export const MINAS_2026_PARTIAL = {
  through: 'agosto de 2026',
  consolidatedDebt: 217165894197.27,
  netDebt: 173163037552.95,
  deductions: 44002856644.32,
  netDebtRatio: 147.09,
  currentRevenue: 82687810647.61,
}

export const MINAS_2025_DEDUCTIONS = 26413745448.25

export interface MinasGovernment {
  id: string
  governor: string
  party: string
  period: string
  startYear: number
  endYear: number
  note?: string
}

export const MINAS_GOVERNMENTS: MinasGovernment[] = [
  { id: 'pimentel', governor: 'Fernando Pimentel', party: 'PT', period: '2015–2018', startYear: 2014, endYear: 2018 },
  { id: 'zema-1', governor: 'Romeu Zema', party: 'Novo', period: '2019–2022', startYear: 2018, endYear: 2022 },
  { id: 'zema-2', governor: 'Romeu Zema', party: 'Novo', period: '2023–2025', startYear: 2022, endYear: 2025, note: 'O segundo mandato segue até 2026. A comparação para no último ano fechado.' },
]

const CLOSED_YEAR = 2025

export function fiscalYear(year: number): MinasFiscalYear {
  const found = MINAS_FISCAL_SERIES.find((entry) => entry.year === year)
  if (!found) throw new Error(`Ano ${year} fora da série fiscal de Minas`)
  return found
}

export function formatBillions(reais: number): string {
  const [whole, fraction] = (reais / 1e9).toFixed(1).split('.')
  return `${whole}.${fraction}`.replace('.', ',')
}

export function formatRatio(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

export function formatSignedPercent(ratio: number): string {
  const percent = ratio * 100
  const sign = percent > 0 ? '+' : percent < 0 ? '-' : ''
  return `${sign}${Math.abs(percent).toFixed(1).replace('.', ',')}%`
}

export function amountChange(startYear: number, endYear: number, field: 'consolidatedDebt' | 'netDebt' | 'currentRevenue'): number {
  const start = fiscalYear(startYear)[field]
  const end = fiscalYear(endYear)[field]
  if (start === null || end === null) throw new Error('Série sem valor para a variação')
  return (end - start) / start
}

export function averageAnnualRevenue(startYear: number, endYear: number): number {
  const years = MINAS_FISCAL_SERIES.filter((entry) => entry.year >= startYear && entry.year <= endYear && entry.currentRevenue !== null)
  const total = years.reduce((sum, entry) => sum + (entry.currentRevenue ?? 0), 0)
  return total / years.length
}

export interface RevenueShare {
  label: string
  color: string
  amount: number
  share: number
}

export function revenueShares(year: number): RevenueShare[] {
  const entry = fiscalYear(year)
  if (entry.currentRevenue === null || entry.taxes === null || entry.transfers === null || entry.contributions === null || entry.patrimonial === null) {
    throw new Error(`Composição indisponível em ${year}`)
  }
  const named = entry.taxes + entry.transfers + entry.contributions + entry.patrimonial
  const parts = [
    { label: 'Impostos, taxas e contribuições de melhoria', color: '#0284c7', amount: entry.taxes },
    { label: 'Transferências correntes', color: '#14b8a6', amount: entry.transfers },
    { label: 'Contribuições', color: '#a78bfa', amount: entry.contributions },
    { label: 'Receita patrimonial', color: '#f59e0b', amount: entry.patrimonial },
    { label: 'Outras receitas correntes', color: '#94a3b8', amount: entry.currentRevenue - named },
  ]
  return parts.map((part) => ({ ...part, share: part.amount / entry.currentRevenue! }))
}

export function compositionYear(selectedYear: number): number {
  return selectedYear >= 2015 && selectedYear <= CLOSED_YEAR ? selectedYear : CLOSED_YEAR
}

export function governmentOf(year: number): string {
  if (year === 2014) return 'Posição herdada em 31/12/2014'
  if (year <= 2018) return 'Fernando Pimentel (PT)'
  if (year <= 2022) return 'Romeu Zema (Novo), 1º mandato'
  return 'Romeu Zema (Novo), 2º mandato'
}
