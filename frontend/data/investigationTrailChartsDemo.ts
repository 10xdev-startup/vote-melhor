// Valores inteiramente fictícios para validar a interface, sem vínculo com as fontes oficiais.
interface DemoCategory {
  label: string
  color: string
  shares: number[] // Participação ilustrativa em 2023, 2024, 2025 e 2026.
}

interface DemoCharts {
  revenue?: DemoCategory[]
  expenses?: DemoCategory[]
  debt?: { year: number; index: number }[]
  scope: string
}

const revenue: DemoCategory[] = [
  { label: 'Tributos', color: '#0284c7', shares: [58, 60, 56, 61] },
  { label: 'Transferências', color: '#14b8a6', shares: [25, 23, 27, 22] },
  { label: 'Outras receitas', color: '#a78bfa', shares: [17, 17, 17, 17] },
]
const expenses: DemoCategory[] = [
  { label: 'Educação', color: '#0284c7', shares: [28, 30, 29, 31] },
  { label: 'Saúde', color: '#14b8a6', shares: [24, 25, 26, 24] },
  { label: 'Segurança', color: '#a78bfa', shares: [18, 16, 17, 16] },
  { label: 'Outras áreas', color: '#94a3b8', shares: [30, 29, 28, 29] },
]
const debt = [100, 110, 106, 119, 127, 123, 134].map((index, position) => ({ year: 2020 + position, index }))

export const DEMO_CHARTS: Record<string, DemoCharts> = {
  'contas-minas': { revenue, expenses, debt, scope: 'Exemplo visual estadual. Valores e distribuições não representam Minas Gerais.' },
  'receitas-minas': { revenue, scope: 'Exemplo de composição da receita estadual, sem valores oficiais.' },
  'divida-minas': { debt, scope: 'Exemplo de saldo da dívida estadual. Não representa pagamentos anuais.' },
  'contas-brasil': {
    revenue: [
      { label: 'Receitas tributárias', color: '#0284c7', shares: [64, 62, 65, 63] },
      { label: 'Contribuições', color: '#14b8a6', shares: [25, 26, 24, 26] },
      { label: 'Outras receitas', color: '#a78bfa', shares: [11, 12, 11, 11] },
    ],
    expenses: [
      { label: 'Previdência', color: '#0284c7', shares: [38, 36, 37, 35] },
      { label: 'Saúde', color: '#14b8a6', shares: [22, 23, 24, 23] },
      { label: 'Educação', color: '#a78bfa', shares: [18, 19, 18, 20] },
      { label: 'Outras áreas', color: '#94a3b8', shares: [22, 22, 21, 22] },
    ],
    debt: [100, 108, 114, 111, 122, 130, 126].map((index, position) => ({ year: 2020 + position, index })),
    scope: 'Receitas e despesas: exemplo federal. Dívida: exemplo de saldo da dívida federal. Os gráficos são independentes; não consolidam União, Governo Geral ou setor público.',
  },
}
