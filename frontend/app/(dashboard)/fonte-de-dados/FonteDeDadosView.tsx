'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileJson, FileSpreadsheet, Info, Loader2, Search, Table2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { filterDatasets } from '@/lib/dataCatalogSearch'
import { dataCatalogService } from '@/services/dataCatalogService'
import type { DataFile, Dataset, DatasetEdition, FilePreview, SourceSystem } from '@/types/dataCatalog'

/**
 * Cor unica da pagina. Azul de proposito: nao sugere entrada nem saida, entao separa
 * visualmente sem insinuar um significado que o dado nao carrega. Cor por conjunto so volta
 * a fazer sentido se virar semantica de verdade (campo do modelo), nao posicao na lista.
 * As classes ficam por extenso porque o Tailwind so enxerga literais.
 */
const ACCENT = {
  header: 'bg-sky-50/70 dark:bg-sky-950/25',
  icon: 'text-sky-600 dark:text-sky-400',
  badge: 'border-sky-300/70 bg-sky-100/70 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300',
  row: 'hover:bg-sky-50/60 dark:hover:bg-sky-950/20',
  rowText: 'group-hover:text-sky-700 dark:group-hover:text-sky-300',
  link: 'hover:text-sky-700 dark:hover:text-sky-300',
  step: 'hover:border-sky-300 hover:bg-sky-100/70 hover:text-sky-800 dark:hover:border-sky-900 dark:hover:bg-sky-950/50 dark:hover:text-sky-300',
}

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Sem Intl/Date: o valor ja vem como data pura (sem hora), e `new Date('2025-12-31')` e
// lido como UTC — no fuso do Brasil isso viraria 30/12.
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

function countFiles(datasets: Dataset[]): number {
  return datasets.reduce(
    (total, dataset) => total + dataset.editions.reduce((sum, edition) => sum + edition.files.length, 0),
    0
  )
}

function MetaItem({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="flex items-center gap-1 font-medium text-foreground/80">
        {value}
        {children}
      </dd>
    </div>
  )
}

/**
 * O "i" ao lado da sigla: hover explica o sistema, clique abre a pagina oficial que sustenta
 * a explicacao. E link (nao botao) de proposito — no touch o tooltip nao abre, e ai o clique
 * ainda leva o usuario a fonte.
 */
function SourceSystemInfo({ system }: { system: SourceSystem }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={system.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`O que é ${system.name}`}
          className={cn('rounded-full text-muted-foreground/60 transition-colors', ACCENT.link)}
        >
          <Info className="size-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {system.description}
      </TooltipContent>
    </Tooltip>
  )
}

/** A tabela do preview. Rola na horizontal: os arquivos do governo passam de 19 colunas. */
function TabularPreview({ preview }: { preview: Extract<FilePreview, { layout: 'tabular' }> }) {
  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      <div className="max-h-[32rem] max-w-full overflow-auto rounded border bg-background">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className={ACCENT.header}>
              {preview.columns.map((column, index) => (
                <th
                  key={`${column}-${index}`}
                  scope="col"
                  className="sticky top-0 z-10 whitespace-nowrap border-b bg-sky-50 px-3 py-2 text-left font-semibold dark:bg-sky-950"
                >
                  {preview.columnTotals[column] !== undefined && (
                    <span className="mb-0.5 block text-[11px] font-bold text-foreground">
                      Total: {BRL_FORMATTER.format(preview.columnTotals[column])}
                    </span>
                  )}
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground/70">
        {preview.truncated
          ? `Primeiras ${preview.rowCount} de ${preview.totalRowCount.toLocaleString('pt-BR')} linhas · ${preview.columns.length} colunas. Baixe o arquivo para ver tudo.`
          : `${preview.totalRowCount.toLocaleString('pt-BR')} linhas · ${preview.columns.length} colunas.`}
      </p>
    </div>
  )
}

function isReportValue(value: string): boolean {
  return value === '-' || /^-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?$/.test(value)
}

function reportCellSpan(columnCount: number, cellCount: number, cellIndex: number): number {
  const base = Math.floor(columnCount / cellCount)
  return base + (cellIndex < columnCount % cellCount ? 1 : 0)
}

/**
 * Demonstrativos do SIAFI usam celulas vazias para posicionar blocos lado a lado. O backend
 * remove so as colunas inteiramente vazias; esta grade conserva o arranjo contabil restante.
 */
function FinancialReportPreview({ preview }: { preview: Extract<FilePreview, { layout: 'report' }> }) {
  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      <div className="mb-3">
        <p className="text-xs font-semibold text-foreground">{preview.title}</p>
        <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          {preview.metadata.map((item) => (
            <div key={item.label} className="flex gap-1">
              <dt className="text-muted-foreground/70">{item.label}</dt>
              <dd className="font-medium text-foreground/75">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="max-h-[32rem] max-w-full overflow-auto rounded border bg-background">
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">{preview.title}</caption>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-b last:border-b-0',
                  row.kind === 'section' && ACCENT.header,
                  row.kind === 'header' && 'bg-muted/60 font-semibold text-foreground',
                  row.kind === 'total' && 'bg-muted/25 font-semibold text-foreground',
                )}
              >
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    colSpan={row.kind === 'section' ? reportCellSpan(preview.columnCount, row.cells.length, cellIndex) : 1}
                    className={cn(
                      'min-w-28 whitespace-nowrap px-3 py-1.5 text-muted-foreground',
                      row.kind !== 'data' && 'text-foreground/85',
                      isReportValue(cell) && 'text-right font-mono tabular-nums',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted-foreground/70">
        {preview.truncated
          ? `Primeiras ${preview.rowCount} de ${preview.totalRowCount.toLocaleString('pt-BR')} linhas do demonstrativo.`
          : `${preview.totalRowCount.toLocaleString('pt-BR')} linhas · ${preview.columnCount} colunas úteis.`}
      </p>
    </div>
  )
}

function FilePreviewContent({ preview }: { preview: FilePreview }) {
  return preview.layout === 'report' ? (
    <FinancialReportPreview preview={preview} />
  ) : (
    <TabularPreview preview={preview} />
  )
}

function FileRow({ file }: { file: DataFile }) {
  const Icon = file.format === 'JSON' ? FileJson : FileSpreadsheet
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    // Busca uma vez e reusa: reabrir nao deve bater na origem de novo.
    if (preview || loading) return

    setLoading(true)
    setError(null)
    try {
      setPreview(await dataCatalogService.getFilePreview(file.id, file.layout === 'report' ? 200 : undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao ler o arquivo')
    } finally {
      setLoading(false)
    }
  }, [open, preview, loading, file.id, file.layout])

  return (
    <div>
      <div className={cn('group flex items-center gap-4 px-4 py-3 transition-colors', ACCENT.row)}>
        <Icon className={cn('size-4 shrink-0', ACCENT.icon)} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span
              className={cn('shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide', ACCENT.badge)}
            >
              {file.format}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{file.description}</p>
        </div>

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">{formatBytes(file.sizeInBytes)}</span>

        <button
          type="button"
          onClick={() => void toggle()}
          aria-expanded={open}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors',
            ACCENT.step
          )}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Table2 className="size-3.5" />}
          Ver
          <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        </button>

        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Baixar ${file.name}`}
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors',
            ACCENT.rowText
          )}
        >
          Baixar
          <Download className="size-3.5" />
        </a>
      </div>

      {open && (
        <>
          {loading && (
            <div className="border-t bg-muted/20 px-4 py-3">
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {/* A mensagem fala do que o usuário fez (ver), não do download que o backend faz
              por baixo — quem clicou em Ver não tentou baixar nada. */}
          {error && (
            <div className="border-t bg-muted/20 px-4 py-3 text-xs">
              <p className="font-medium text-destructive">Não foi possível exibir o conteúdo agora</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          )}
          {preview && <FilePreviewContent preview={preview} />}
        </>
      )}
    </div>
  )
}

/** Setas de exercicio: os mesmos seis demonstrativos se repetem todo ano, entao o card e um so. */
function EditionNav({
  editions,
  index,
  onSelect,
}: {
  editions: DatasetEdition[]
  index: number
  onSelect: (edition: DatasetEdition) => void
}) {
  const previous = editions[index - 1]
  const next = editions[index + 1]
  const stepClass = cn(
    'rounded border bg-background/60 p-1 text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-30',
    ACCENT.step
  )

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-muted-foreground/70">Exercício</span>
      <button
        type="button"
        onClick={() => previous && onSelect(previous)}
        disabled={!previous}
        aria-label="Exercício anterior"
        className={stepClass}
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className={cn('min-w-11 rounded border px-2 py-0.5 text-center text-xs font-semibold tabular-nums', ACCENT.badge)}>
        {editions[index]?.label}
      </span>
      <button
        type="button"
        onClick={() => next && onSelect(next)}
        disabled={!next}
        aria-label="Próximo exercício"
        className={stepClass}
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

function DatasetCard({ dataset }: { dataset: Dataset }) {
  // Guarda o id, nao o indice: a busca muda a lista de edicoes debaixo do card, e um
  // indice guardado apontaria pro ano errado (ou pra fora da lista).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIndex = dataset.editions.findIndex((edition) => edition.id === selectedId)
  const index = selectedIndex === -1 ? dataset.editions.length - 1 : selectedIndex
  const edition = dataset.editions[index]
  const hasEditions = dataset.editions.length > 1

  if (!edition) return null

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className={cn('border-b px-4 py-3', ACCENT.header)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{dataset.title}</h2>
              <span className={cn('rounded-full border px-2 py-px text-[10px] font-semibold', ACCENT.badge)}>
                {dataset.updateFrequency}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{dataset.description}</p>
          </div>
          <a
            href={dataset.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:underline',
              ACCENT.link
            )}
          >
            Portal oficial
            <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs">
          <dl className="flex flex-wrap gap-x-5 gap-y-1">
            {!hasEditions && <MetaItem label="Período" value={edition.label} />}
            <MetaItem label="Origem" value={dataset.sourceSystem.name}>
              <SourceSystemInfo system={dataset.sourceSystem} />
            </MetaItem>
            <MetaItem label="Atualizado em" value={formatDate(edition.updatedAt)} />
          </dl>

          {hasEditions && (
            <EditionNav editions={dataset.editions} index={index} onSelect={(next) => setSelectedId(next.id)} />
          )}
        </div>
      </header>

      <div className="divide-y">
        {edition.files.map((file) => (
          <FileRow key={file.id} file={file} />
        ))}
      </div>
    </section>
  )
}

export function FonteDeDadosView() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // O catalogo vem da API (o `apiClient` le a sessao do Supabase, entao isso e client-side).
  useEffect(() => {
    let active = true
    dataCatalogService
      .getCatalog()
      .then((data) => {
        if (active) setDatasets(data)
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o catálogo')
      })
    return () => {
      active = false
    }
  }, [])

  const results = useMemo(() => filterDatasets(datasets ?? [], query), [datasets, query])

  const totalFiles = datasets ? countFiles(datasets) : 0
  const visibleFiles = countFiles(results)

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-4xl px-2 pb-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Fonte de dados</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Os arquivos que o governo já publica, com nome legível e o que cada um contém.
          </p>
        </header>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por arquivo, conjunto ou ano — ex.: fluxo de caixa, 2023, despesas"
            className="pl-9"
            aria-label="Buscar no catálogo"
          />
        </div>

        {datasets && (
          <p className="mt-3 text-xs text-muted-foreground">
            {query.trim()
              ? `${visibleFiles} de ${totalFiles} arquivos`
              : `${totalFiles} arquivos em ${datasets.length} conjuntos · Senado Federal · Orçamento do Senado`}
          </p>
        )}

        {loadError && (
          <div className="mt-6 rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Não foi possível carregar o catálogo</p>
            <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          </div>
        )}

        {!datasets && !loadError && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {datasets && results.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Nenhum arquivo encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tente um termo mais curto, como “balanço”, “receitas” ou o ano.
            </p>
          </div>
        )}

        {datasets && results.length > 0 && (
          <div className="mt-6 space-y-4">
            {results.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
