import { describe, it, expect, beforeEach } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FonteDeDadosView } from "@/app/(dashboard)/fonte-de-dados/FonteDeDadosView"
import { dataCatalogService } from "@/services/dataCatalogService"
import { CATALOG_FIXTURE } from "./fixtures/dataCatalog"
import { ROADMAP_FIXTURE } from "./fixtures/dataRoadmap"
import type { Dataset, FilePreview } from "@/types/dataCatalog"
import type { DataRoadmapSection } from "@/types/dataRoadmap"

type MockFn<T> = {
  (...args: never[]): unknown
  mockReset: () => void
  mockResolvedValue: (value: T) => void
  mockResolvedValueOnce: (value: T) => void
  mockRejectedValue: (value: unknown) => void
}

/**
 * `jest` aqui e o GLOBAL, e nao `import { jest } from "@jest/globals"` — de proposito.
 *
 * O `jest.mock` precisa ser hoisted acima dos imports pra valer, e quem faz esse hoisting no
 * frontend e o transform do SWC (next/jest), que so reconhece o identificador global. Com o
 * `jest` importado de `@jest/globals`, o mock NAO e aplicado e nada avisa: o componente chama
 * o service de verdade e o teste passa sem testar o que devia. Por isso o import nomeado do
 * projeto vale pra `describe/it/expect`, mas nao pra `jest.mock`.
 */
declare const jest: {
  mock: (moduleName: string, factory: () => unknown) => void
  fn: () => MockFn<never>
}

// Mocka o service (dep externa), nunca o componente sob teste.
jest.mock("@/services/dataCatalogService", () => ({
  dataCatalogService: { getCatalog: jest.fn(), getRoadmap: jest.fn(), getFilePreview: jest.fn() },
}))

jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push: (href: string) => window.history.pushState(null, "", href),
    replace: (href: string) => window.history.replaceState(null, "", href),
  }),
}))

const getCatalog = dataCatalogService.getCatalog as unknown as MockFn<Dataset[]>
const getRoadmap = dataCatalogService.getRoadmap as unknown as MockFn<DataRoadmapSection[]>
const getFilePreview = dataCatalogService.getFilePreview as unknown as MockFn<FilePreview>

const PREVIEW: FilePreview = {
  layout: "tabular",
  fileId: "receitas-csv",
  columns: ["Data da carga", "Órgão Superior", "Receita Arrecadada"],
  rows: [["09/08/26", "02000 - SENADO FEDERAL", "2483,60"]],
  rowCount: 1,
  totalRowCount: 1234,
  unfilteredRowCount: 1234,
  appliedFilters: [],
  facets: [
    { column: "Data da carga", totalDistinctValues: 1, options: [{ value: "09/08/26", count: 1234 }] },
    { column: "Órgão Superior", totalDistinctValues: 1, options: [{ value: "02000 - SENADO FEDERAL", count: 1234 }] },
    { column: "Receita Arrecadada", totalDistinctValues: 1234, options: [{ value: "2483,60", count: 1 }] },
  ],
  page: 1,
  pageSize: 20,
  totalPages: 62,
  columnTotals: { "Receita Arrecadada": 13483.6 },
  truncated: true,
}

const REPORT_PREVIEW: FilePreview = {
  layout: "report",
  fileId: "demonstracoes-2025-bp",
  title: "BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS",
  metadata: [
    { label: "Exercício", value: "2025" },
    { label: "Unidade", value: "Valores em unidades de real" },
  ],
  rows: [
    { cells: ["ATIVO", "PASSIVO"], kind: "section" },
    { cells: ["Caixa e Equivalentes de Caixa", "1,300,705,195.95", "Obrigações", "255,493,108.07"], kind: "data" },
  ],
  columnCount: 4,
  rowCount: 2,
  totalRowCount: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  truncated: false,
}

const ACTION_PREVIEW: FilePreview = {
  ...PREVIEW,
  columns: ["Exercício Financeiro (Lan-Ef)", "Ação (nome)", "Valor Pago"],
  rows: [["2026", "CONTRIBUIÇÕES REGULARES", "10800,00"], ["2025", "OUTRA AÇÃO", "5000,00"]],
  rowCount: 2,
  totalRowCount: 2,
  unfilteredRowCount: 2,
  totalPages: 1,
  columnTotals: { "Valor Pago": 15800 },
  facets: [
    { column: "Exercício Financeiro (Lan-Ef)", totalDistinctValues: 2, options: [{ value: "2026", count: 1 }, { value: "2025", count: 1 }] },
    { column: "Ação (nome)", totalDistinctValues: 2, options: [{ value: "CONTRIBUIÇÕES REGULARES", count: 1 }, { value: "OUTRA AÇÃO", count: 1 }] },
    { column: "Valor Pago", totalDistinctValues: 2, options: [{ value: "10800,00", count: 1 }, { value: "5000,00", count: 1 }] },
  ],
}

beforeEach(() => {
  window.history.replaceState(null, "", "/fonte-de-dados")
  getCatalog.mockReset()
  getRoadmap.mockReset()
  getFilePreview.mockReset()
  getCatalog.mockResolvedValue(CATALOG_FIXTURE)
  getRoadmap.mockResolvedValue(ROADMAP_FIXTURE)
})

async function renderView() {
  render(<FonteDeDadosView />)
  // Espera o catalogo chegar: o input existe desde o primeiro paint, entao esperar por ele
  // seguiria com a tela ainda em skeleton.
  await screen.findByText(/arquivos em/)
  return screen.getByLabelText("Buscar no catálogo")
}

function expandAllDatasets() {
  screen.getAllByRole("button", { name: /^Expandir / }).forEach((button) => fireEvent.click(button))
}

describe("FonteDeDadosView", () => {
  it("abre diretamente na aba indicada pela URL", async () => {
    window.history.replaceState(null, "", "/fonte-de-dados?tab=sumario")
    render(<FonteDeDadosView />)

    expect(screen.getByRole("tab", { name: "Sumário" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByText("Senado Federal — próximo núcleo")).toBeInTheDocument()
    expect(screen.queryByLabelText("Buscar no catálogo")).not.toBeInTheDocument()
  })

  it("separa o roadmap do catálogo nas abas Sumário e Dados", async () => {
    await renderView()

    expect(screen.getByRole("tab", { name: "Dados" })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(screen.getByRole("tab", { name: "Sumário" }))

    expect(screen.getByRole("tab", { name: "Sumário" })).toHaveAttribute("aria-selected", "true")
    expect(window.location.search).toBe("?tab=sumario")
    expect(screen.getByText("Senado Federal — próximo núcleo")).toBeInTheDocument()
    expect(screen.getByText("Câmara e controle federal")).toBeInTheDocument()
    expect(screen.queryByText("Mapa de integrações da Vote Melhor")).not.toBeInTheDocument()
    expect(screen.getByText("Senado Federal — próximo núcleo").compareDocumentPosition(screen.getByText("Já disponível")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByLabelText("Buscar no catálogo")).not.toBeInTheDocument()
    expect(getRoadmap).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("tab", { name: "Dados" }))
    expect(window.location.search).toBe("?tab=dados")
  })

  it("leva um conjunto disponível do Sumário para o resultado correspondente em Dados", async () => {
    await renderView()
    fireEvent.click(screen.getByRole("tab", { name: "Sumário" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Ver em Dados" })[1]!)

    expect(screen.getByRole("tab", { name: "Dados" })).toHaveAttribute("aria-selected", "true")
    expect(window.location.search).toBe("?tab=dados")
    expect(screen.getByLabelText("Buscar no catálogo")).toHaveValue("receitas próprias")
    expect(screen.getByText("Receitas próprias")).toBeInTheDocument()
  })

  it("filtra o cardápio pelos indicadores de status e limpa ao clicar novamente", async () => {
    await renderView()
    fireEvent.click(screen.getByRole("tab", { name: "Sumário" }))

    const mappedFilter = screen.getByRole("button", { name: "Filtrar por Mapeado" })
    fireEvent.click(mappedFilter)
    expect(mappedFilter).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Senadores, mandatos e filiações")).toBeInTheDocument()
    expect(screen.queryByText("Receitas próprias")).not.toBeInTheDocument()
    expect(screen.queryByText("Tribunais superiores")).not.toBeInTheDocument()

    fireEvent.click(mappedFilter)
    expect(mappedFilter).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Receitas próprias")).toBeInTheDocument()
  })

  it("mostra todas as fontes oficiais associadas a uma frente", async () => {
    await renderView()
    fireEvent.click(screen.getByRole("tab", { name: "Sumário" }))

    expect(screen.getByRole("link", { name: "API DataJud" })).toHaveAttribute("href", "https://datajud-wiki.cnj.jus.br/api-publica/")
    expect(screen.getByRole("link", { name: "Estatísticas STF" })).toHaveAttribute("href", "https://portal.stf.jus.br/estatistica/")
  })

  it("carrega o catálogo pela API e mostra a contagem", async () => {
    await renderView()
    expect(getCatalog).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("group", { name: "Filtros" })).toBeInTheDocument()
    expect(screen.getByText(/8 arquivos em 2 conjuntos/)).toBeInTheDocument()
  })

  it("mostra erro quando o catálogo não carrega", async () => {
    getCatalog.mockRejectedValue(new Error("Falha ao chamar a API"))
    render(<FonteDeDadosView />)
    expect(await screen.findByText("Não foi possível carregar o catálogo")).toBeInTheDocument()
  })

  it("mantém Dados funcional quando apenas o roadmap não carrega", async () => {
    getRoadmap.mockRejectedValue(new Error("Falha ao carregar o roadmap"))
    await renderView()

    expect(screen.getByText(/8 arquivos em 2 conjuntos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Sumário" }))
    expect(await screen.findByText("Não foi possível carregar o roadmap")).toBeInTheDocument()
    expect(screen.getByText("Falha ao carregar o roadmap")).toBeInTheDocument()
  })

  it("abre no exercício mais recente e navega pelas setas", async () => {
    await renderView()
    expect(screen.getByText("2025")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Exercício anterior"))
    expect(screen.getByText("2024")).toBeInTheDocument()
    expect(screen.getByLabelText("Baixar Balanço Patrimonial")).toHaveAttribute(
      "href",
      expect.stringContaining("/2024/")
    )
  })

  it("filtra ao digitar", async () => {
    const input = await renderView()
    fireEvent.change(input, { target: { value: "fluxo de caixa" } })
    expect(screen.getByText("3 de 8 arquivos")).toBeInTheDocument()
  })

  it("oferece Ver nos arquivos tabulares e nos demonstrativos contábeis", async () => {
    await renderView()
    expandAllDatasets()
    // Dois arquivos do Arquimedes + dois demonstrativos do exercício aberto na fixture.
    expect(screen.getAllByRole("button", { name: /Ver/ })).toHaveLength(4)
    expect(screen.getByLabelText("Baixar Balanço Patrimonial")).toBeInTheDocument()
  })

  it("inicia cada conjunto recolhido e permite expandi-lo e recolhê-lo", async () => {
    await renderView()
    const expand = screen.getByRole("button", { name: /Expandir Demonstrações Contábeis/ })
    const file = screen.getByText("Balanço Patrimonial")
    expect(expand).toHaveTextContent(/Expandir.*2 arquivos/)
    expect(expand).toHaveAttribute("aria-expanded", "false")
    expect(file).not.toBeVisible()
    expect(screen.getByText("Demonstrações Contábeis")).toBeVisible()

    fireEvent.click(expand)
    expect(screen.getByRole("button", { name: /Recolher Demonstrações Contábeis/ })).toHaveAttribute("aria-expanded", "true")
    expect(file).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: /Recolher Demonstrações Contábeis/ }))
    expect(file).not.toBeVisible()
  })

  it("busca e exibe o conteúdo ao clicar em Ver, preservando o valor original", async () => {
    getFilePreview.mockResolvedValue(PREVIEW)
    await renderView()
    expandAllDatasets()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)

    expect(await screen.findByRole("columnheader", { name: "Órgão Superior" })).toBeInTheDocument()
    // O valor tem que chegar igual ao do arquivo: sem virar data americana nem perder a virgula.
    expect(screen.getByText("09/08/26")).toBeInTheDocument()
    const formattedRevenue = screen.getByTitle("Valor publicado: 2483,60")
    expect(formattedRevenue).toHaveTextContent(/R\$\s2\.483,60/)
    expect(screen.getByText("Total: R$ 13.483,60")).toBeInTheDocument()
    expect(screen.getByText(/Linhas 1–1 de 1\.234 · 3 colunas/)).toBeInTheDocument()
    expect(formattedRevenue.closest("table")?.parentElement).toHaveClass(
      "max-h-[32rem]",
      "overflow-auto"
    )
  })

  it("não busca de novo ao fechar e reabrir", async () => {
    getFilePreview.mockResolvedValue(PREVIEW)
    await renderView()
    expandAllDatasets()
    const verButton = screen.getAllByRole("button", { name: /Ver/ })[0]!

    fireEvent.click(verButton)
    await screen.findByRole("columnheader", { name: "Órgão Superior" })
    fireEvent.click(verButton)
    fireEvent.click(verButton)

    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Órgão Superior" })).toBeInTheDocument())
    expect(getFilePreview).toHaveBeenCalledTimes(1)
  })

  it("pagina por todas as linhas e reutiliza páginas já carregadas", async () => {
    const secondPage: FilePreview = { ...PREVIEW, page: 2, rows: [["10/08/26", "02000 - SENADO FEDERAL", "3000,00"]] }
    getFilePreview.mockResolvedValueOnce(PREVIEW)
    getFilePreview.mockResolvedValueOnce(secondPage)
    await renderView()
    expandAllDatasets()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)
    expect(await screen.findByText("Página 1 de 62")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))

    expect(await screen.findByText("Página 2 de 62")).toBeInTheDocument()
    expect(screen.getByText("10/08/26")).toBeInTheDocument()
    expect(getFilePreview).toHaveBeenNthCalledWith(1, "receitas-csv", 1, 20, [])
    expect(getFilePreview).toHaveBeenNthCalledWith(2, "receitas-csv", 2, 20, [])

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }))
    expect(await screen.findByText("Página 1 de 62")).toBeInTheDocument()
    expect(getFilePreview).toHaveBeenCalledTimes(2)
  })

  it("filtra qualquer coluna sobre o arquivo inteiro antes de paginar", async () => {
    const filteredPreview: FilePreview = {
      ...ACTION_PREVIEW,
      rows: [["2026", "CONTRIBUIÇÕES REGULARES", "10800,00"]],
      rowCount: 1,
      totalRowCount: 1,
      appliedFilters: [{ column: "Exercício Financeiro (Lan-Ef)", operator: "equals", value: "2026" }],
      columnTotals: { "Valor Pago": 10800 },
    }
    const doublyFilteredPreview: FilePreview = {
      ...filteredPreview,
      appliedFilters: [
        { column: "Exercício Financeiro (Lan-Ef)", operator: "equals", value: "2026" },
        { column: "Ação (nome)", operator: "equals", value: "CONTRIBUIÇÕES REGULARES" },
      ],
    }
    getFilePreview.mockResolvedValueOnce(ACTION_PREVIEW)
    getFilePreview.mockResolvedValueOnce(filteredPreview)
    getFilePreview.mockResolvedValueOnce(doublyFilteredPreview)
    await renderView()
    expandAllDatasets()
    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)
    await screen.findByText("Filtrar tabela")

    fireEvent.change(screen.getByLabelText("Coluna do filtro"), { target: { value: "Exercício Financeiro (Lan-Ef)" } })
    fireEvent.change(screen.getByLabelText("Valor do filtro"), { target: { value: "2026" } })
    fireEvent.click(screen.getByRole("button", { name: "Adicionar filtro" }))

    expect(await screen.findByRole("button", { name: "Remover filtro Exercício Financeiro (Lan-Ef): 2026" })).toBeInTheDocument()
    expect(screen.getByText("Adicionar outro filtro")).toBeInTheDocument()
    expect(screen.getByText(/Linhas 1–1 de 1 · 3 colunas · 2 linhas no arquivo/)).toBeInTheDocument()
    expect(getFilePreview).toHaveBeenNthCalledWith(2, "receitas-csv", 1, 20, [{ column: "Exercício Financeiro (Lan-Ef)", operator: "equals", value: "2026" }])

    fireEvent.change(screen.getByLabelText("Coluna do filtro"), { target: { value: "Ação (nome)" } })
    fireEvent.change(screen.getByLabelText("Valor do filtro"), { target: { value: "CONTRIBUIÇÕES REGULARES" } })
    fireEvent.click(screen.getByRole("button", { name: "Adicionar filtro" }))

    expect(await screen.findByRole("button", { name: "Remover filtro Ação (nome): CONTRIBUIÇÕES REGULARES" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover filtro Exercício Financeiro (Lan-Ef): 2026" })).toBeInTheDocument()
    expect(getFilePreview).toHaveBeenNthCalledWith(3, "receitas-csv", 1, 20, [
      { column: "Exercício Financeiro (Lan-Ef)", operator: "equals", value: "2026" },
      { column: "Ação (nome)", operator: "equals", value: "CONTRIBUIÇÕES REGULARES" },
    ])
  })

  it("usa seletores de mínimo e máximo para filtros financeiros", async () => {
    const rangePreview: FilePreview = {
      ...ACTION_PREVIEW,
      rows: [["2026", "CONTRIBUIÇÕES REGULARES", "10800,00"]],
      rowCount: 1,
      totalRowCount: 1,
      appliedFilters: [{ column: "Valor Pago", operator: "range", min: "5000,00", max: "10800,00" }],
      columnTotals: { "Valor Pago": 10800 },
    }
    getFilePreview.mockResolvedValueOnce(ACTION_PREVIEW)
    getFilePreview.mockResolvedValueOnce(rangePreview)
    await renderView()
    expandAllDatasets()
    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)
    await screen.findByText("Filtrar tabela")

    fireEvent.change(screen.getByLabelText("Coluna do filtro"), { target: { value: "Valor Pago" } })
    expect(screen.queryByLabelText("Valor do filtro")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Valor mínimo"), { target: { value: "5000,00" } })
    fireEvent.change(screen.getByLabelText("Valor máximo"), { target: { value: "10800,00" } })
    fireEvent.click(screen.getByRole("button", { name: "Adicionar filtro" }))

    expect(await screen.findByRole("button", { name: /Remover filtro Valor Pago: de R\$.*5\.000,00 até R\$.*10\.800,00/ })).toBeInTheDocument()
    expect(getFilePreview).toHaveBeenNthCalledWith(2, "receitas-csv", 1, 20, [{ column: "Valor Pago", operator: "range", min: "5000,00", max: "10800,00" }])
  })

  it("exibe e pagina o demonstrativo contábil preservando os blocos", async () => {
    getFilePreview.mockResolvedValue(REPORT_PREVIEW)
    await renderView()
    expandAllDatasets()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[2]!)

    expect(await screen.findAllByText("BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS")).toHaveLength(2)
    expect(screen.getByText("ATIVO")).toBeInTheDocument()
    expect(screen.getByText("PASSIVO")).toBeInTheDocument()
    const formattedReportValue = screen.getByTitle("Valor publicado: 1,300,705,195.95")
    expect(formattedReportValue).toHaveTextContent(/R\$\s1\.300\.705\.195,95/)
    expect(formattedReportValue.closest("table")?.parentElement).toHaveClass(
      "max-h-[32rem]",
      "overflow-auto"
    )
    expect(getFilePreview).toHaveBeenCalledWith("demonstracoes-2025-bp", 1, 20, [])
  })

  it("falhando o preview, explica em termos de ver — não de baixar", async () => {
    getFilePreview.mockRejectedValue(new Error("O site do órgão não respondeu"))
    await renderView()
    expandAllDatasets()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)

    expect(await screen.findByText("Não foi possível exibir o conteúdo agora")).toBeInTheDocument()
    expect(screen.getByText("O site do órgão não respondeu")).toBeInTheDocument()
  })

  it("mostra estado vazio quando a busca não casa", async () => {
    const input = await renderView()
    fireEvent.change(input, { target: { value: "votação nominal" } })
    expect(screen.getByText("Nenhum arquivo encontrado")).toBeInTheDocument()
  })
})
