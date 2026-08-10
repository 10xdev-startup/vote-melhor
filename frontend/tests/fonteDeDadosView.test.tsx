import { describe, it, expect, beforeEach } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FonteDeDadosView } from "@/app/(dashboard)/fonte-de-dados/FonteDeDadosView"
import { dataCatalogService } from "@/services/dataCatalogService"
import { CATALOG_FIXTURE } from "./fixtures/dataCatalog"
import type { Dataset, FilePreview } from "@/types/dataCatalog"

type MockFn<T> = {
  (...args: never[]): unknown
  mockReset: () => void
  mockResolvedValue: (value: T) => void
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
  dataCatalogService: { getCatalog: jest.fn(), getFilePreview: jest.fn() },
}))

const getCatalog = dataCatalogService.getCatalog as unknown as MockFn<Dataset[]>
const getFilePreview = dataCatalogService.getFilePreview as unknown as MockFn<FilePreview>

const PREVIEW: FilePreview = {
  layout: "tabular",
  fileId: "receitas-csv",
  columns: ["Data da carga", "Órgão Superior", "Receita Arrecadada"],
  rows: [["09/08/26", "02000 - SENADO FEDERAL", "2483,60"]],
  rowCount: 1,
  totalRowCount: 1234,
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
  truncated: false,
}

beforeEach(() => {
  getCatalog.mockReset()
  getFilePreview.mockReset()
  getCatalog.mockResolvedValue(CATALOG_FIXTURE)
})

async function renderView() {
  render(<FonteDeDadosView />)
  // Espera o catalogo chegar: o input existe desde o primeiro paint, entao esperar por ele
  // seguiria com a tela ainda em skeleton.
  await screen.findByText(/arquivos em/)
  return screen.getByLabelText("Buscar no catálogo")
}

describe("FonteDeDadosView", () => {
  it("carrega o catálogo pela API e mostra a contagem", async () => {
    await renderView()
    expect(getCatalog).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/8 arquivos em 2 conjuntos/)).toBeInTheDocument()
  })

  it("mostra erro quando o catálogo não carrega", async () => {
    getCatalog.mockRejectedValue(new Error("Falha ao chamar a API"))
    render(<FonteDeDadosView />)
    expect(await screen.findByText("Não foi possível carregar o catálogo")).toBeInTheDocument()
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
    // Dois arquivos do Arquimedes + dois demonstrativos do exercício aberto na fixture.
    expect(screen.getAllByRole("button", { name: /Ver/ })).toHaveLength(4)
    expect(screen.getByLabelText("Baixar Balanço Patrimonial")).toBeInTheDocument()
  })

  it("busca e exibe o conteúdo ao clicar em Ver, preservando o valor original", async () => {
    getFilePreview.mockResolvedValue(PREVIEW)
    await renderView()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[0]!)

    expect(await screen.findByText("Órgão Superior")).toBeInTheDocument()
    // O valor tem que chegar igual ao do arquivo: sem virar data americana nem perder a virgula.
    expect(screen.getByText("09/08/26")).toBeInTheDocument()
    expect(screen.getByText("2483,60")).toBeInTheDocument()
    expect(screen.getByText("Total: R$ 13.483,60")).toBeInTheDocument()
    expect(screen.getByText(/Primeiras 1 de 1\.234 linhas · 3 colunas/)).toBeInTheDocument()
    expect(screen.getByText("2483,60").closest("table")?.parentElement).toHaveClass(
      "max-h-[32rem]",
      "overflow-auto"
    )
  })

  it("não busca de novo ao fechar e reabrir", async () => {
    getFilePreview.mockResolvedValue(PREVIEW)
    await renderView()
    const verButton = screen.getAllByRole("button", { name: /Ver/ })[0]!

    fireEvent.click(verButton)
    await screen.findByText("Órgão Superior")
    fireEvent.click(verButton)
    fireEvent.click(verButton)

    await waitFor(() => expect(screen.getByText("Órgão Superior")).toBeInTheDocument())
    expect(getFilePreview).toHaveBeenCalledTimes(1)
  })

  it("exibe o demonstrativo contábil preservando os blocos e pede até 200 linhas", async () => {
    getFilePreview.mockResolvedValue(REPORT_PREVIEW)
    await renderView()

    fireEvent.click(screen.getAllByRole("button", { name: /Ver/ })[2]!)

    expect(await screen.findAllByText("BALANÇO PATRIMONIAL - TODOS OS ORÇAMENTOS")).toHaveLength(2)
    expect(screen.getByText("ATIVO")).toBeInTheDocument()
    expect(screen.getByText("PASSIVO")).toBeInTheDocument()
    expect(screen.getByText("1,300,705,195.95")).toBeInTheDocument()
    expect(screen.getByText("1,300,705,195.95").closest("table")?.parentElement).toHaveClass(
      "max-h-[32rem]",
      "overflow-auto"
    )
    expect(getFilePreview).toHaveBeenCalledWith("demonstracoes-2025-bp", 200)
  })

  it("falhando o preview, explica em termos de ver — não de baixar", async () => {
    getFilePreview.mockRejectedValue(new Error("O site do órgão não respondeu"))
    await renderView()

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
