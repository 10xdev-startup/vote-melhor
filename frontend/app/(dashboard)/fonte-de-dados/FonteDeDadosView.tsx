'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, Compass, Download, ExternalLink, FileJson, FileSpreadsheet, Info, Loader2, Search, Table2, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { filterDatasets } from '@/lib/dataCatalogSearch'
import { dataCatalogService } from '@/services/dataCatalogService'
import type { DataFile, Dataset, DatasetEdition, DatasetGovernmentTerm, FilePreview, FilePreviewFilter, SourceSystem } from '@/types/dataCatalog'
import type { DataRoadmapItem, DataRoadmapSection, DataRoadmapStatus } from '@/types/dataRoadmap'

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
const CURRENCY_COLUMN_PATTERN = /\b(VALOR|DOTACAO|EMPENHAD[OA]|LIQUIDAD[OA]|PAG[OA]|PAGAMENTO|RECEITA|DESPESA|PREVISAO|ARRECADAD[OA]|SALDO)\b/

const ROADMAP_STATUS = {
  available: {
    label: 'Disponível',
    description: 'Já pode ser consultado na aba Dados.',
    icon: CheckCircle2,
    badge: 'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300',
  },
  mapped: {
    label: 'Mapeado',
    description: 'Fonte oficial identificada; integração ainda não implementada.',
    icon: Compass,
    badge: ACCENT.badge,
  },
  discovery: {
    label: 'A mapear',
    description: 'Tema priorizado; contrato e conjuntos ainda precisam ser definidos.',
    icon: CircleDashed,
    badge: 'border-border bg-muted/60 text-muted-foreground',
  },
} as const

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

function countRoadmapItems(sections: DataRoadmapSection[], status: DataRoadmapStatus): number {
  return sections.reduce(
    (total, section) => total + section.items.filter((item) => item.status === status).length,
    0,
  )
}

function isCurrencyColumn(column: string): boolean {
  const normalized = column.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  return CURRENCY_COLUMN_PATTERN.test(normalized)
}

function parseBrazilianCurrency(value: string): number | undefined {
  const compact = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(compact)) return undefined
  const amount = Number(compact.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(amount) ? amount : undefined
}

function formatBrazilianCurrency(value: string): string | undefined {
  const amount = parseBrazilianCurrency(value)
  return amount === undefined ? undefined : BRL_FORMATTER.format(amount)
}

function formatCompactCurrency(amount: number): string {
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000_000) return `R$ ${(amount / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`
  if (absolute >= 1_000_000) return `R$ ${(amount / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  return BRL_FORMATTER.format(amount)
}

function describeFilter(filter: FilePreviewFilter): string {
  if (filter.operator === 'equals') return filter.value
  const min = filter.min ? formatBrazilianCurrency(filter.min) ?? filter.min : undefined
  const max = filter.max ? formatBrazilianCurrency(filter.max) ?? filter.max : undefined
  if (min && max) return `de ${min} até ${max}`
  if (min) return `a partir de ${min}`
  return `até ${max}`
}

function isTabularNumber(value: string): boolean {
  return /^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?$/.test(value.trim())
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
function PreviewPagination({ preview, detail, loading, onPageChange }: { preview: FilePreview; detail: string; loading: boolean; onPageChange: (page: number) => void }) {
  const firstRow = preview.totalRowCount === 0 ? 0 : (preview.page - 1) * preview.pageSize + 1
  const lastRow = preview.rowCount === 0 ? 0 : Math.min(firstRow + preview.rowCount - 1, preview.totalRowCount)
  const stepClass = cn('flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-35', ACCENT.step)

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/70">
      <p aria-live="polite">Linhas {firstRow.toLocaleString('pt-BR')}–{lastRow.toLocaleString('pt-BR')} de {preview.totalRowCount.toLocaleString('pt-BR')} · {detail}.</p>
      <nav className="flex items-center gap-2" aria-label="Paginação do arquivo">
        <button type="button" disabled={loading || preview.page <= 1} onClick={() => onPageChange(preview.page - 1)} className={stepClass}>
          <ChevronLeft className="size-3.5" />
          Anterior
        </button>
        <span className="min-w-24 text-center font-medium tabular-nums text-foreground/75">
          Página {preview.page.toLocaleString('pt-BR')} de {preview.totalPages.toLocaleString('pt-BR')}
        </span>
        <button type="button" disabled={loading || preview.page >= preview.totalPages} onClick={() => onPageChange(preview.page + 1)} className={stepClass}>
          Próxima
          <ChevronRight className="size-3.5" />
        </button>
      </nav>
    </div>
  )
}

interface YearComparison {
  year: number
  columnTotals: Record<string, number>
}

interface PreviewComparisons {
  previous?: YearComparison
  next?: YearComparison
}

function formatPercentageAgainst(current: number, comparison: number): string | undefined {
  if (comparison === 0) return undefined
  const percentage = ((current - comparison) / Math.abs(comparison)) * 100
  if (Math.abs(percentage) < 0.05) return '0,0%'
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function GovernmentInvestmentSummary({ currentFile, preview, comparisons, seriesFiles, terms }: { currentFile: DataFile; preview: Extract<FilePreview, { layout: 'tabular' }>; comparisons: PreviewComparisons; seriesFiles: DataFile[]; terms: DatasetGovernmentTerm[] }) {
  const currentYear = currentFile.sourceQuery?.year
  const [summaries, setSummaries] = useState<Record<number, YearComparison>>({})
  const [failedYears, setFailedYears] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const totalsCache = useRef(new Map<number, YearComparison>())
  const pendingTotals = useRef(new Map<number, Promise<YearComparison>>())
  const requestId = useRef(0)
  const displayTerms = [...terms].reverse().map((term) => ({ ...term, years: [...term.years].reverse() }))
  const governmentYears = displayTerms.flatMap((term) => term.years)
  const mandateSources = Array.from(new Map(terms.map((term) => [term.referenceUrl, term.referenceLabel])).entries())

  useEffect(() => {
    const nextRequestId = requestId.current + 1
    requestId.current = nextRequestId
    const initial: Record<number, YearComparison> = {}

    if (currentYear !== undefined && preview.appliedFilters.length === 0) {
      totalsCache.current.set(currentYear, { year: currentYear, columnTotals: preview.columnTotals })
      if (comparisons.previous) totalsCache.current.set(comparisons.previous.year, comparisons.previous)
      if (comparisons.next) totalsCache.current.set(comparisons.next.year, comparisons.next)
    }
    governmentYears.forEach(({ year }) => {
      const cached = totalsCache.current.get(year)
      if (cached) initial[year] = cached
    })
    setSummaries(initial)
    setFailedYears([])
    setLoadedCount(Object.keys(initial).length)
    setLoading(true)

    const load = async () => {
      const failures: number[] = []
      let completed = Object.keys(initial).length
      for (const { year } of governmentYears) {
        if (requestId.current !== nextRequestId) return
        if (totalsCache.current.has(year)) continue
        const yearFile = seriesFiles.find((candidate) => candidate.name === currentFile.name && candidate.sourceQuery?.year === year)
        if (!yearFile) {
          failures.push(year)
          completed += 1
          setFailedYears([...failures])
          setLoadedCount(completed)
          continue
        }
        try {
          let pending = pendingTotals.current.get(year)
          if (!pending) {
            pending = dataCatalogService.getFilePreview(yearFile.id, 1, 1, []).then((yearPreview) => {
              if (yearPreview.layout !== 'tabular') throw new Error('Formato inesperado')
              return { year, columnTotals: yearPreview.columnTotals }
            })
            pendingTotals.current.set(year, pending)
          }
          const summary = await pending
          pendingTotals.current.delete(year)
          if (requestId.current !== nextRequestId) return
          totalsCache.current.set(year, summary)
          setSummaries((current) => ({ ...current, [year]: summary }))
        } catch {
          pendingTotals.current.delete(year)
          failures.push(year)
          setFailedYears([...failures])
        }
        completed += 1
        setLoadedCount(completed)
      }
      if (requestId.current === nextRequestId) setLoading(false)
    }

    void load()
    return () => {
      requestId.current += 1
    }
  }, [currentFile.name, seriesFiles, terms])

  return (
    <section className="mb-3 rounded-md border bg-background p-3" aria-label="Investimentos por gestão estadual">
      <div>
        <p className="text-xs font-semibold text-foreground">Todos os exercícios por gestão estadual</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Os 17 anos permanecem separados e são agrupados apenas para mostrar em qual mandato ocorreram. Anos com troca de governador são marcados como transição.</p>
      </div>

      <div className="mt-3 max-w-full overflow-auto rounded border">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className={ACCENT.header}>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-left font-semibold">Ano</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-left font-semibold">Responsável no exercício</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Orçamento aprovado</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Orçamento atualizado</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Valor comprometido</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Despesa reconhecida</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Dinheiro pago</th>
              <th className="whitespace-nowrap border-b px-3 py-2 text-right font-semibold">% do orçamento pago</th>
            </tr>
          </thead>
          {displayTerms.map((term) => (
            <tbody key={term.id}>
              <tr className="border-b bg-muted/35">
                <th colSpan={8} scope="rowgroup" className="px-3 py-2 text-left font-semibold">
                  {term.label} <span className="ml-1 font-normal text-muted-foreground">· {term.period}</span>
                </th>
              </tr>
              {term.years.map((yearInfo) => {
                const summary = summaries[yearInfo.year]
                const currentBudget = summary?.columnTotals['Dotação atual'] ?? 0
                const paid = summary?.columnTotals['Valor pago'] ?? 0
                const executionRate = currentBudget > 0 ? (paid / currentBudget) * 100 : undefined
                const value = (column: string) => summary ? formatCompactCurrency(summary.columnTotals[column] ?? 0) : failedYears.includes(yearInfo.year) ? 'Indisponível' : 'Carregando…'
                return (
                  <tr key={yearInfo.year} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap border-r px-3 py-2 font-semibold tabular-nums">{yearInfo.year}{yearInfo.year === 2026 ? <span className="ml-1.5 rounded border px-1 py-px text-[9px] font-medium text-muted-foreground">parcial</span> : null}</td>
                    <td className="whitespace-nowrap border-r px-3 py-2 text-muted-foreground">{yearInfo.governor}{yearInfo.transition ? <span className="ml-1.5 rounded border px-1 py-px text-[9px] font-medium">transição</span> : null}</td>
                    {['Dotação inicial', 'Dotação atual', 'Valor empenhado', 'Valor liquidado', 'Valor pago'].map((column) => <td key={column} className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums text-foreground/80">{value(column)}</td>)}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{summary ? executionRate === undefined ? '—' : `${executionRate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : failedYears.includes(yearInfo.year) ? '—' : 'Carregando…'}</td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground/75">
        {loading && <p>Carregando {loadedCount} de {governmentYears.length} exercícios, um por vez…</p>}
        <p>Valores nominais publicados pelo SIAFEM/SP; não corrigidos pela inflação.</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {mandateSources.map(([url, label]) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={cn('flex items-center gap-1 underline-offset-4 hover:underline', ACCENT.link)}>{label}<ExternalLink className="size-3" /></a>)}
        </div>
      </div>
    </section>
  )
}

function TabularPreview({ currentFile, preview, comparisons, comparisonLoading, governmentTerms, seriesFiles, loading, onPageChange, onFiltersChange }: { currentFile: DataFile; preview: Extract<FilePreview, { layout: 'tabular' }>; comparisons: PreviewComparisons; comparisonLoading: boolean; governmentTerms: DatasetGovernmentTerm[]; seriesFiles: DataFile[]; loading: boolean; onPageChange: (page: number) => void; onFiltersChange: (filters: FilePreviewFilter[]) => void }) {
  const [summaryMode, setSummaryMode] = useState<'year' | 'government'>('year')
  const [filterColumn, setFilterColumn] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [filterMin, setFilterMin] = useState('')
  const [filterMax, setFilterMax] = useState('')
  const currencyColumns = useMemo(() => preview.columns.map(isCurrencyColumn), [preview.columns])
  const numericColumns = useMemo(() => preview.columns.map((_column, columnIndex) => {
    const values = preview.rows.map((row) => row[columnIndex] ?? '').filter((value) => value !== '')
    return values.length > 0 && values.filter(isTabularNumber).length / values.length >= 0.8
  }), [preview.columns, preview.rows])
  const selectedFacet = preview.facets.find((facet) => facet.column === filterColumn)
  const selectedIsCurrency = filterColumn !== '' && isCurrencyColumn(filterColumn)
  const parsedMin = filterMin.trim() ? parseBrazilianCurrency(filterMin) : undefined
  const parsedMax = filterMax.trim() ? parseBrazilianCurrency(filterMax) : undefined
  const rangeIsValid = selectedIsCurrency && (filterMin.trim() !== '' || filterMax.trim() !== '') && (!filterMin.trim() || parsedMin !== undefined) && (!filterMax.trim() || parsedMax !== undefined) && (parsedMin === undefined || parsedMax === undefined || parsedMin <= parsedMax)
  const canApplyFilter = filterColumn !== '' && (selectedIsCurrency ? rangeIsValid : filterValue.trim() !== '')
  const financialOptions = useMemo(() => (selectedFacet?.options ?? [])
    .map((option) => ({ ...option, amount: parseBrazilianCurrency(option.value) }))
    .filter((option): option is typeof option & { amount: number } => option.amount !== undefined)
    .sort((left, right) => left.amount - right.amount), [selectedFacet])
  const isSpInvestmentPreview = ['Exercício', 'Grupo da despesa', 'Órgão', 'Elemento da despesa', 'Dotação inicial', 'Valor empenhado'].every((column) => preview.columns.includes(column))
  const investmentYear = preview.facets.find((facet) => facet.column === 'Exercício')?.options[0]?.value
  const investmentPhases = [
    { column: 'Dotação inicial', label: 'Orçamento aprovado', detail: 'Dotação inicial · valor aprovado na LOA' },
    { column: 'Dotação atual', label: 'Orçamento atualizado', detail: 'Dotação atual · após créditos e alterações' },
    { column: 'Valor empenhado', label: 'Valor comprometido', detail: 'Empenhado · reservado para despesas' },
    { column: 'Valor liquidado', label: 'Despesa reconhecida', detail: 'Liquidado · obrigação já conferida' },
    { column: 'Valor pago', label: 'Dinheiro pago', detail: 'Pago · valor já desembolsado' },
  ].flatMap((phase) => preview.columnTotals[phase.column] === undefined ? [] : [{ ...phase, amount: preview.columnTotals[phase.column] }])

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canApplyFilter) return
    const nextFilter: FilePreviewFilter = selectedIsCurrency
      ? { column: filterColumn, operator: 'range', ...(filterMin.trim() ? { min: filterMin.trim() } : {}), ...(filterMax.trim() ? { max: filterMax.trim() } : {}) }
      : { column: filterColumn, operator: 'equals', value: filterValue.trim() }
    onFiltersChange([...preview.appliedFilters.filter((filter) => filter.column !== filterColumn), nextFilter])
    setFilterColumn('')
    setFilterValue('')
    setFilterMin('')
    setFilterMax('')
  }

  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      {isSpInvestmentPreview && governmentTerms.length > 0 && (
        <div className="mb-2 flex w-fit rounded-md border bg-background p-0.5" role="group" aria-label="Modo do resumo de investimentos">
          <button type="button" aria-pressed={summaryMode === 'year'} onClick={() => setSummaryMode('year')} className={cn('rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors', summaryMode === 'year' && 'bg-muted text-foreground')}>Por exercício</button>
          <button type="button" aria-pressed={summaryMode === 'government'} onClick={() => setSummaryMode('government')} disabled={comparisonLoading} title={comparisonLoading ? 'Aguarde a comparação anual terminar' : undefined} className={cn('rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors disabled:opacity-50', summaryMode === 'government' && 'bg-muted text-foreground')}>Por gestão</button>
        </div>
      )}
      {isSpInvestmentPreview && summaryMode === 'government' && governmentTerms.length > 0 ? (
        <GovernmentInvestmentSummary currentFile={currentFile} preview={preview} comparisons={comparisons} seriesFiles={seriesFiles} terms={governmentTerms} />
      ) : isSpInvestmentPreview ? (
        <section className="mb-3 rounded-md border bg-background p-3" aria-label="Resumo do exercício">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Números do exercício{investmentYear ? ` ${investmentYear}` : ''}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                O dinheiro avança por estas etapas: orçamento aprovado → atualizado → comprometido → reconhecido → pago.
              </p>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                <p><span className="font-semibold text-foreground/75">LOA</span> — Lei Orçamentária Anual, o orçamento aprovado.</p>
                <p><span className="font-semibold text-foreground/75">PLOA</span> — Projeto de Lei Orçamentária Anual, a proposta enviada antes da aprovação.</p>
              </div>
            </div>
            {preview.appliedFilters.length > 0 && <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', ACCENT.badge)}>Totais com filtros</span>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {investmentPhases.map((phase) => {
              const currentYear = investmentYear ? Number(investmentYear) : undefined
              const previousPercentage = comparisons.previous
                ? formatPercentageAgainst(phase.amount, comparisons.previous.columnTotals[phase.column] ?? 0)
                : undefined
              const nextPercentage = comparisons.next
                ? formatPercentageAgainst(comparisons.next.columnTotals[phase.column] ?? 0, phase.amount)
                : undefined

              return (
                <div key={phase.column} className="rounded-md border bg-muted/15 px-3 py-2" title={BRL_FORMATTER.format(phase.amount)}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{phase.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatCompactCurrency(phase.amount)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{phase.detail}</p>
                  <p className="mt-1 truncate text-[10px] tabular-nums text-muted-foreground/75">{BRL_FORMATTER.format(phase.amount)}</p>
                  <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {comparisons.previous && <span>{comparisons.previous.year} → {currentYear}: <strong className="font-semibold text-foreground/70">{previousPercentage ?? '—'}</strong></span>}
                    {comparisons.next && <span>{currentYear} → {comparisons.next.year}: <strong className="font-semibold text-foreground/70">{nextPercentage ?? '—'}</strong></span>}
                    {comparisonLoading && <span>Carregando comparações…</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {(comparisons.previous || comparisons.next) && <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/75">As variações comparam a mesma etapa entre exercícios; anos em andamento apresentam valores parciais.</p>}
        </section>
      ) : null}
      <div className="mb-3 rounded-md border bg-background p-2.5">
        <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground/80">{preview.appliedFilters.length > 0 ? 'Adicionar outro filtro' : 'Filtrar tabela'}</span>
          <select
            value={filterColumn}
            onChange={(event) => { setFilterColumn(event.target.value); setFilterValue(''); setFilterMin(''); setFilterMax('') }}
            aria-label="Coluna do filtro"
            className="h-8 max-w-64 rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Escolha uma coluna</option>
            {preview.facets.map((facet) => <option key={facet.column} value={facet.column} disabled={preview.appliedFilters.some((filter) => filter.column === facet.column)}>{facet.column}</option>)}
          </select>
          {selectedIsCurrency ? (
            <div className="flex min-w-72 flex-1 items-center gap-2">
              <select value={filterMin} onChange={(event) => setFilterMin(event.target.value)} aria-label="Valor mínimo" className="h-8 min-w-40 flex-1 rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Sem mínimo</option>
                {financialOptions.map((option) => <option key={option.value} value={option.value}>{formatBrazilianCurrency(option.value)} · {option.count.toLocaleString('pt-BR')} linhas</option>)}
              </select>
              <span className="text-xs text-muted-foreground">até</span>
              <select value={filterMax} onChange={(event) => setFilterMax(event.target.value)} aria-label="Valor máximo" className="h-8 min-w-40 flex-1 rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Sem máximo</option>
                {financialOptions.map((option) => <option key={option.value} value={option.value}>{formatBrazilianCurrency(option.value)} · {option.count.toLocaleString('pt-BR')} linhas</option>)}
              </select>
            </div>
          ) : (
            <select
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              disabled={!filterColumn}
              aria-label="Valor do filtro"
              className="h-8 min-w-56 flex-1 rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">{filterColumn ? 'Escolha um valor' : 'Escolha a coluna primeiro'}</option>
              {selectedFacet?.options.map((option) => <option key={option.value} value={option.value}>{option.value} · {option.count.toLocaleString('pt-BR')} linhas</option>)}
            </select>
          )}
          <button type="submit" disabled={loading || !canApplyFilter} className={cn('h-8 rounded border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-40', ACCENT.step)}>
            Adicionar filtro
          </button>
        </form>

        {preview.appliedFilters.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Filtros aplicados">
            {preview.appliedFilters.map((filter) => {
              const description = describeFilter(filter)
              return (
                <button
                  key={filter.column}
                  type="button"
                  aria-label={`Remover filtro ${filter.column}: ${description}`}
                  onClick={() => onFiltersChange(preview.appliedFilters.filter((current) => current.column !== filter.column))}
                  className={cn('flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] text-foreground/75 transition-colors', ACCENT.badge)}
                >
                  <span className="max-w-72 truncate"><span className="font-semibold">{filter.column}:</span> {description}</span>
                  <X className="size-3 shrink-0" />
                </button>
              )
            })}
            {preview.appliedFilters.length > 1 && <button type="button" onClick={() => onFiltersChange([])} className={cn('px-1.5 text-[11px] text-muted-foreground underline-offset-4 hover:underline', ACCENT.link)}>Limpar todos</button>}
          </div>
        )}
      </div>

      <div className="max-h-[32rem] max-w-full overflow-auto rounded border bg-background">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className={ACCENT.header}>
              {preview.columns.map((column, index) => (
                <th
                  key={`${column}-${index}`}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-r bg-sky-50 px-3 py-2 text-left font-semibold last:border-r-0 dark:bg-sky-950',
                    numericColumns[index] && 'text-right',
                    index === 0 && 'left-0 z-20 shadow-[2px_0_0_hsl(var(--border))]',
                  )}
                >
                  {preview.columnTotals[column] !== undefined && !isSpInvestmentPreview && (
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
            {preview.rows.length === 0 && (
              <tr><td colSpan={preview.columns.length} className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhuma linha corresponde aos filtros aplicados.</td></tr>
            )}
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b odd:bg-muted/15 last:border-b-0 hover:bg-sky-50/60 dark:hover:bg-sky-950/20">
                {row.map((cell, cellIndex) => {
                  const formattedCurrency = currencyColumns[cellIndex] ? formatBrazilianCurrency(cell) : undefined
                  return (
                    <td
                      key={cellIndex}
                      title={formattedCurrency ? `Valor publicado: ${cell}` : undefined}
                      className={cn(
                        'whitespace-nowrap border-r px-3 py-1.5 text-muted-foreground last:border-r-0',
                        numericColumns[cellIndex] && 'text-right tabular-nums',
                        formattedCurrency && 'font-medium text-foreground/80',
                        cellIndex === 0 && 'sticky left-0 z-[5] bg-background shadow-[2px_0_0_hsl(var(--border))]',
                      )}
                    >
                      {formattedCurrency ?? cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PreviewPagination preview={preview} detail={`${preview.columns.length} colunas${preview.appliedFilters.length > 0 ? ` · ${preview.unfilteredRowCount.toLocaleString('pt-BR')} linhas no arquivo` : ''}`} loading={loading} onPageChange={onPageChange} />
    </div>
  )
}

function isReportValue(value: string): boolean {
  return value === '-' || /^-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?$/.test(value)
}

function formatReportCurrency(value: string): string | undefined {
  if (!/^-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})$/.test(value)) return undefined
  const amount = Number(value.replace(/,/g, ''))
  return Number.isFinite(amount) ? BRL_FORMATTER.format(amount) : undefined
}

function reportCellSpan(columnCount: number, cellCount: number, cellIndex: number): number {
  const base = Math.floor(columnCount / cellCount)
  return base + (cellIndex < columnCount % cellCount ? 1 : 0)
}

/**
 * Demonstrativos do SIAFI usam celulas vazias para posicionar blocos lado a lado. O backend
 * remove so as colunas inteiramente vazias; esta grade conserva o arranjo contabil restante.
 */
function FinancialReportPreview({ preview, loading, onPageChange }: { preview: Extract<FilePreview, { layout: 'report' }>; loading: boolean; onPageChange: (page: number) => void }) {
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
                {row.cells.map((cell, cellIndex) => {
                  const formattedCurrency = (row.kind === 'data' || row.kind === 'total') ? formatReportCurrency(cell) : undefined
                  return (
                    <td
                      key={cellIndex}
                      colSpan={row.kind === 'section' ? reportCellSpan(preview.columnCount, row.cells.length, cellIndex) : 1}
                      title={formattedCurrency ? `Valor publicado: ${cell}` : undefined}
                      className={cn(
                        'min-w-28 whitespace-nowrap border-r px-3 py-1.5 text-muted-foreground last:border-r-0',
                        row.kind !== 'data' && 'text-foreground/85',
                        isReportValue(cell) && 'text-right font-mono tabular-nums',
                      )}
                    >
                      {formattedCurrency ?? cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PreviewPagination preview={preview} detail={`${preview.columnCount} colunas úteis`} loading={loading} onPageChange={onPageChange} />
    </div>
  )
}

function FilePreviewContent({ currentFile, preview, comparisons, comparisonLoading, governmentTerms, seriesFiles, loading, onPageChange, onFiltersChange }: { currentFile: DataFile; preview: FilePreview; comparisons: PreviewComparisons; comparisonLoading: boolean; governmentTerms: DatasetGovernmentTerm[]; seriesFiles: DataFile[]; loading: boolean; onPageChange: (page: number) => void; onFiltersChange: (filters: FilePreviewFilter[]) => void }) {
  return preview.layout === 'report' ? (
    <FinancialReportPreview preview={preview} loading={loading} onPageChange={onPageChange} />
  ) : (
    <TabularPreview currentFile={currentFile} preview={preview} comparisons={comparisons} comparisonLoading={comparisonLoading} governmentTerms={governmentTerms} seriesFiles={seriesFiles} loading={loading} onPageChange={onPageChange} onFiltersChange={onFiltersChange} />
  )
}

function FileRow({ file, previousFile, nextFile, governmentTerms, seriesFiles }: { file: DataFile; previousFile: DataFile | undefined; nextFile: DataFile | undefined; governmentTerms: DatasetGovernmentTerm[]; seriesFiles: DataFile[] }) {
  const Icon = file.format === 'JSON' ? FileJson : FileSpreadsheet
  const isApiSource = file.sourceQuery !== undefined
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [comparisons, setComparisons] = useState<PreviewComparisons>({})
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewCache = useRef(new Map<string, FilePreview>())
  const comparisonCache = useRef(new Map<string, PreviewComparisons>())
  const comparisonRequestId = useRef(0)
  const previousFileId = useRef(file.id)

  const loadPage = useCallback(async (page: number, filters: FilePreviewFilter[]) => {
    const cacheKey = JSON.stringify([page, filters])
    const cached = previewCache.current.get(cacheKey)
    if (cached) {
      setPreview(cached)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const nextPreview = await dataCatalogService.getFilePreview(file.id, page, 20, filters)
      previewCache.current.set(cacheKey, nextPreview)
      setPreview(nextPreview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao ler o arquivo')
    } finally {
      setLoading(false)
    }
  }, [file.id])

  const loadComparisons = useCallback(async (filters: FilePreviewFilter[]) => {
    const requestId = comparisonRequestId.current + 1
    comparisonRequestId.current = requestId

    if (!file.sourceQuery) {
      setComparisons({})
      setComparisonLoading(false)
      return
    }

    const cacheKey = JSON.stringify([file.id, previousFile?.id, nextFile?.id, filters])
    const cached = comparisonCache.current.get(cacheKey)
    if (cached) {
      setComparisons(cached)
      setComparisonLoading(false)
      return
    }

    setComparisons({})
    setComparisonLoading(true)
    const result: PreviewComparisons = {}
    const candidates: Array<['previous' | 'next', DataFile | undefined]> = [['previous', previousFile], ['next', nextFile]]

    for (const [relation, candidate] of candidates) {
      if (!candidate?.sourceQuery) continue
      const comparisonFilters = filters.filter((filter) => filter.column !== 'Exercício')
      try {
        const neighborPreview = await dataCatalogService.getFilePreview(candidate.id, 1, 1, comparisonFilters)
        if (neighborPreview.layout !== 'tabular') continue
        const comparison = { year: candidate.sourceQuery.year, columnTotals: neighborPreview.columnTotals }
        if (relation === 'previous') result.previous = comparison
        else result.next = comparison
        if (comparisonRequestId.current === requestId) setComparisons({ ...result })
      } catch {
        // A indisponibilidade de um exercício vizinho não impede a leitura do ano atual.
      }
    }

    if (comparisonRequestId.current !== requestId) return
    comparisonCache.current.set(cacheKey, result)
    setComparisons(result)
    setComparisonLoading(false)
  }, [file.id, file.sourceQuery, nextFile, previousFile])

  useEffect(() => {
    if (previousFileId.current === file.id) return
    previousFileId.current = file.id
    comparisonRequestId.current += 1
    previewCache.current.clear()
    setPreview(null)
    setComparisons({})
    setComparisonLoading(false)
    setError(null)
    if (open) {
      void loadPage(1, []).then(() => loadComparisons([]))
    }
  }, [file.id, loadComparisons, loadPage, open])

  const toggle = useCallback(async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    // Cada pagina e guardada no card: reabrir ou voltar nao bate na origem de novo.
    if (preview || loading) return
    await loadPage(1, [])
    void loadComparisons([])
  }, [open, preview, loading, loadComparisons, loadPage])

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
          aria-label={isApiSource ? `Abrir API oficial de ${file.name}` : `Baixar ${file.name}`}
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors',
            ACCENT.rowText
          )}
        >
          {isApiSource ? 'API oficial' : 'Baixar'}
          {isApiSource ? <ExternalLink className="size-3.5" /> : <Download className="size-3.5" />}
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
          {preview && <FilePreviewContent currentFile={file} preview={preview} comparisons={comparisons} comparisonLoading={comparisonLoading} governmentTerms={governmentTerms} seriesFiles={seriesFiles} loading={loading} onPageChange={(page) => void loadPage(page, preview.layout === 'tabular' ? preview.appliedFilters : [])} onFiltersChange={(filters) => void loadPage(1, filters).then(() => loadComparisons(filters))} />}
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
  const [isExpanded, setIsExpanded] = useState(false)
  const selectedIndex = dataset.editions.findIndex((edition) => edition.id === selectedId)
  const index = selectedIndex === -1 ? dataset.editions.length - 1 : selectedIndex
  const edition = dataset.editions[index]
  const hasEditions = dataset.editions.length > 1

  if (!edition) return null
  const fileCountLabel = `${edition.files.length} ${edition.files.length === 1 ? 'arquivo' : 'arquivos'}`

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className={cn('px-4 py-3', isExpanded && 'border-b', ACCENT.header)}>
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

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-2 text-xs">
          <div className="flex flex-col items-start gap-2">
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {!hasEditions && <MetaItem label="Período" value={edition.label} />}
              <MetaItem label="Origem" value={dataset.sourceSystem.name}>
                <SourceSystemInfo system={dataset.sourceSystem} />
              </MetaItem>
              <MetaItem label="Atualizado em" value={formatDate(edition.updatedAt)} />
            </dl>
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={`dataset-files-${dataset.id}`}
              aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} ${dataset.title} — ${fileCountLabel}`}
              onClick={() => setIsExpanded((current) => !current)}
              className={cn('flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:underline', ACCENT.link)}
            >
              {isExpanded ? 'Recolher' : 'Expandir'}
              <span aria-hidden="true" className="font-normal text-muted-foreground/70">· {fileCountLabel}</span>
              <ChevronDown className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')} />
            </button>
          </div>
          {hasEditions && (
            <EditionNav editions={dataset.editions} index={index} onSelect={(next) => setSelectedId(next.id)} />
          )}
        </div>
      </header>

      <div id={`dataset-files-${dataset.id}`} hidden={!isExpanded} className="divide-y">
        {edition.files.map((file) => (
          <FileRow key={file.name} file={file} previousFile={dataset.editions[index - 1]?.files.find((candidate) => candidate.name === file.name)} nextFile={dataset.editions[index + 1]?.files.find((candidate) => candidate.name === file.name)} governmentTerms={dataset.governmentTerms ?? []} seriesFiles={dataset.editions.flatMap((candidateEdition) => candidateEdition.files)} />
        ))}
      </div>
    </section>
  )
}

function RoadmapCard({ item, onOpenData }: { item: DataRoadmapItem; onOpenData: (query: string) => void }) {
  const status = ROADMAP_STATUS[item.status]
  const StatusIcon = status.icon
  const officialSources = item.officialSources ?? [{ label: 'Fonte oficial', url: item.officialUrl }]

  return (
    <article className="flex h-full flex-col rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{item.organ}</p>
          <h3 className="mt-1 text-sm font-semibold leading-snug">{item.title}</h3>
        </div>
        <span
          title={status.description}
          className={cn('flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', status.badge)}
        >
          <StatusIcon className="size-3" />
          {status.label}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Formas de acesso">
        {item.access.map((format) => (
          <span key={format} className="rounded border bg-muted/35 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {format}
          </span>
        ))}
      </div>

      <div className="mt-3 border-t pt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Próxima entrega</p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/75">{item.nextStep}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-xs font-medium">
        {item.catalogQuery && (
          <button
            type="button"
            onClick={() => onOpenData(item.catalogQuery!)}
            className={cn('underline-offset-4 transition-colors hover:underline', ACCENT.link)}
          >
            Ver em Dados
          </button>
        )}
        {officialSources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:underline', ACCENT.link)}
          >
            {source.label}
            <ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </article>
  )
}

function RoadmapSummary({ roadmap, error, onOpenData }: { roadmap: DataRoadmapSection[] | null; error: string | null; onOpenData: (query: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<DataRoadmapStatus | null>(null)
  const stats = roadmap
    ? [
        { status: 'available' as const, count: countRoadmapItems(roadmap, 'available') },
        { status: 'mapped' as const, count: countRoadmapItems(roadmap, 'mapped') },
        { status: 'discovery' as const, count: countRoadmapItems(roadmap, 'discovery') },
      ]
    : []
  const visibleSections = useMemo(() => {
    if (!roadmap || !statusFilter) return roadmap ?? []
    return roadmap
      .map((section) => ({ ...section, items: section.items.filter((item) => item.status === statusFilter) }))
      .filter((section) => section.items.length > 0)
  }, [roadmap, statusFilter])

  return (
    <div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab" className="mt-6">
      {error && (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-sm font-medium">Não foi possível carregar o roadmap</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {!roadmap && !error && (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      )}

      {roadmap && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar integrações por status">
            {stats.map(({ status: statusKey, count }) => {
              const status = ROADMAP_STATUS[statusKey]
              const StatusIcon = status.icon
              const isActive = statusFilter === statusKey
              return (
                <button
                  key={statusKey}
                  type="button"
                  aria-label={`Filtrar por ${status.label}`}
                  aria-pressed={isActive}
                  title={isActive ? 'Remover filtro' : status.description}
                  onClick={() => setStatusFilter(isActive ? null : statusKey)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive ? status.badge : 'bg-card hover:bg-muted/60',
                    statusKey === 'discovery' && 'border-zinc-400/80 dark:border-zinc-600',
                  )}
                >
                  <span className={cn('flex items-center gap-1.5 text-xs', !isActive && 'text-muted-foreground')}>
                    <StatusIcon className="size-3" />
                    {status.label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-7">
            {visibleSections.map((section) => (
              <section key={section.id} aria-labelledby={`roadmap-${section.id}`}>
                <div>
                  <h2 id={`roadmap-${section.id}`} className="text-base font-semibold">{section.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                </div>
                <div className="mt-3 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {section.items.map((item) => (
                    <RoadmapCard key={item.id} item={item} onOpenData={onOpenData} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function FonteDeDadosView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') === 'sumario' ? 'summary' : 'data'
  const [activeTab, setActiveTabState] = useState<'summary' | 'data'>(urlTab)
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [roadmap, setRoadmap] = useState<DataRoadmapSection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const syncTabFromHistory = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveTabState(params.get('tab') === 'sumario' ? 'summary' : 'data')
    }
    window.addEventListener('popstate', syncTabFromHistory)
    return () => window.removeEventListener('popstate', syncTabFromHistory)
  }, [])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'sumario' || tabParam === 'dados') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', urlTab === 'summary' ? 'sumario' : 'dados')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, urlTab])

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

    dataCatalogService
      .getRoadmap()
      .then((data) => {
        if (active) setRoadmap(data)
      })
      .catch((err: unknown) => {
        if (active) setRoadmapError(err instanceof Error ? err.message : 'Não foi possível carregar o roadmap')
      })
    return () => {
      active = false
    }
  }, [])

  const results = useMemo(() => filterDatasets(datasets ?? [], query), [datasets, query])

  const totalFiles = datasets ? countFiles(datasets) : 0
  const visibleFiles = countFiles(results)
  const sourceCount = datasets ? new Set(datasets.map((dataset) => dataset.organ)).size : 0

  const selectTab = useCallback((nextTab: 'summary' | 'data') => {
    setActiveTabState(nextTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab === 'summary' ? 'sumario' : 'dados')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const openCatalogAt = useCallback((nextQuery: string) => {
    setQuery(nextQuery)
    selectTab('data')
  }, [selectTab])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-[90rem] px-2 pb-12">
        <div
          role="tablist"
          aria-label="Visões das fontes de dados"
          className="flex w-fit rounded-lg border bg-muted/40 p-1"
        >
          <button
            id="summary-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="summary-panel"
            onClick={() => selectTab('summary')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
              activeTab === 'summary' && 'bg-background text-foreground shadow-sm',
            )}
          >
            Sumário
          </button>
          <button
            id="data-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'data'}
            aria-controls="data-panel"
            onClick={() => selectTab('data')}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
              activeTab === 'data' && 'bg-background text-foreground shadow-sm',
            )}
          >
            Dados
          </button>
        </div>

        {activeTab === 'summary' ? (
          <RoadmapSummary roadmap={roadmap} error={roadmapError} onOpenData={openCatalogAt} />
        ) : (
          <div id="data-panel" role="tabpanel" aria-labelledby="data-tab">
            <fieldset className="mt-6 rounded-lg border bg-muted/10 px-3 pb-3">
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Filtros</legend>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por arquivo, conjunto ou ano — ex.: fluxo de caixa, 2023, despesas"
                  className="bg-background pl-9"
                  aria-label="Buscar no catálogo"
                />
              </div>

              {datasets && (
                <p className="mt-2.5 text-xs text-muted-foreground">
                  {query.trim()
                    ? `${visibleFiles} de ${totalFiles} arquivos`
                    : `${totalFiles} arquivos em ${datasets.length} conjuntos · ${sourceCount} ${sourceCount === 1 ? 'fonte oficial' : 'fontes oficiais'}`}
                </p>
              )}
            </fieldset>

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
        )}
      </div>
    </TooltipProvider>
  )
}
