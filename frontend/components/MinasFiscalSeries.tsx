import { ArrowDown, ArrowUp, ExternalLink, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DatasetFiscalRow, DatasetFiscalSeries } from '@/types/dataCatalog'

function ColumnInfo({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`O que é ${label}`} className="rounded-full text-muted-foreground/70 transition-colors hover:text-sky-700 dark:hover:text-sky-300">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left text-xs font-normal leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function billions(amount: number | null): string {
  if (amount === null) return '—'
  return `R$ ${(amount / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`
}

function ratio(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}%`
}

function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function RevenueCell({ amount, previous, missing, tone }: { amount: number | null; previous: number | null; missing: string; tone: 'revenue' | 'debt' }) {
  const percent = changePercent(amount, previous)
  if (amount === null) return <td className="w-24 border-r px-2 py-1.5 text-right"><span className="font-normal text-muted-foreground" title={missing}>não publicada</span></td>
  const Arrow = percent !== null && percent < 0 ? ArrowDown : ArrowUp
  const color = tone === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  const label = percent === null ? null : `${percent > 0 ? '+' : ''}${percent.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  return (
    <td className="w-24 border-r px-2 py-1.5 text-right">
      <span className="block tabular-nums">{billions(amount)}</span>
      {label && <span className={`inline-flex items-center justify-end text-[9px] leading-tight tabular-nums ${color}`} title="Variação sobre o ano anterior"><Arrow className="size-2.5" aria-hidden="true" />{label}</span>}
    </td>
  )
}

function share(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function IndexerCell({ indexer }: { indexer?: DatasetFiscalRow['indexer'] }) {
  if (!indexer) return <td className="w-28 border-r px-2 py-1.5 text-right"><span className="font-normal text-muted-foreground" title="O boletim mensal da Fazenda está publicado a partir de 2020.">não publicada</span></td>
  return (
    <td className="w-28 border-r px-2 py-1.5 text-right leading-tight">
      <span className="block tabular-nums">{share(indexer.inflation)} inflação</span>
      <span className="block text-[9px] tabular-nums text-muted-foreground/70">câmbio {share(indexer.exchange)}</span>
      <span className="block text-[9px] tabular-nums text-muted-foreground/70">flutuante {share(indexer.floating)} · prefixado {share(indexer.prefixed)}</span>
    </td>
  )
}

function ShortHeader({ title, label, text }: { title: string; label: string; text: string }) {
  return (
    <th className="w-24 border-b border-r px-2 py-2 text-right font-semibold">
      <span className="inline-flex max-w-24 items-center justify-end gap-1">
        <span className="truncate" title={title}>{label}</span>
        <ColumnInfo label={label} text={text} />
      </span>
    </th>
  )
}

export function MinasFiscalSeries({ series }: { series: DatasetFiscalSeries }) {
  return (
    <div className="bg-muted/20 px-4 py-3">
      <p className="text-xs font-semibold text-foreground">Saldo em 31 de dezembro, em reais do relatório</p>
      <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">{series.note}</p>
      <div className="mt-3 max-w-full overflow-auto rounded border bg-background">
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">Dívida e receita de Minas Gerais, de 2000 a 2025, em reais publicados</caption>
          <thead>
            <tr className="bg-sky-50/70 dark:bg-sky-950/25">
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-left font-semibold">Ano</th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-left font-semibold">Responsável no fechamento</th>
              <ShortHeader title="Receita corrente arrecadada" label="Faturamento" text="Quanto entrou naquele ano em impostos, transferências e outras receitas do dia a dia. Não entra empréstimo nem dinheiro passado de um órgão do Estado para outro. Este número só foi publicado a partir de 2015. Antes disso, a célula diz “não publicada”: não é zero. A porcentagem é a variação sobre o ano anterior." />
              <ShortHeader title="Faturamento líquido" label="Fat. Líquido" text="O faturamento depois dos descontos que a lei tira antes de medir a dívida. O maior desconto é a parte que Minas repassa aos municípios. O limite de 200% usa este número. A porcentagem é a variação sobre o ano anterior." />
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">
                <span className="inline-flex items-center justify-end gap-1">
                  Dívida líquida
                  <ColumnInfo label="dívida líquida" text="Quanto Minas devia naquela data, depois de descontar o dinheiro que já estava em caixa. É o saldo da dívida, não o que foi pago naquele ano." />
                </span>
              </th>
              <th className="whitespace-nowrap border-b border-r px-3 py-2 text-right font-semibold">Dívida consolidada</th>
              <th className="w-28 border-b border-r px-2 py-2 text-right font-semibold">
                <span className="inline-flex items-center justify-end gap-1">
                  <span className="truncate" title="Indexador da dívida em dezembro">Indexador</span>
                  <ColumnInfo label="indexador" text="Como a dívida é corrigida no fechamento de dezembro, segundo o boletim da Fazenda. Não é a taxa de juros. A maior parte segue a inflação. O resto é câmbio, taxa flutuante ou prefixado. Antes de 2020 esse boletim não está na página da Fazenda." />
                </span>
              </th>
              <th className="whitespace-nowrap border-b px-3 py-2 text-right font-semibold">
                <span className="inline-flex items-center justify-end gap-1">
                  Líquida / receita
                  <ColumnInfo label="líquida sobre a receita" text="A dívida líquida dividida pelo faturamento líquido. A regra do Senado é 200%: a dívida não pode passar do dobro dessa receita. Acima de 200%, o Estado está fora do limite." />
                </span>
              </th>
            </tr>
          </thead>
          {series.terms.map((term) => {
            const rows = series.rows.filter((row) => row.termId === term.id)
            if (rows.length === 0) return null
            return (
              <tbody key={term.id}>
                <tr className="border-b bg-muted/35">
                  <th colSpan={8} scope="rowgroup" className="px-3 py-2 text-left font-semibold">
                    {term.label} <span className="ml-1 font-normal text-muted-foreground">· {term.period}</span>
                  </th>
                </tr>
                {rows.map((row) => {
                  const previous = series.rows.find((candidate) => candidate.year === row.year - 1)
                  return (
                  <tr key={row.year} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap border-r px-3 py-2 font-semibold tabular-nums">{row.year}</td>
                    <td className="whitespace-nowrap border-r px-3 py-2 text-muted-foreground">
                      {row.governor}
                      {row.transition ? <span className="ml-1.5 rounded border px-1 py-px text-[9px] font-medium">transição</span> : null}
                    </td>
                    <RevenueCell tone="revenue" amount={row.currentRevenue} previous={previous?.currentRevenue ?? null} missing="Este número só foi publicado a partir de 2015." />
                    <RevenueCell tone="revenue" amount={row.netCurrentRevenue} previous={previous?.netCurrentRevenue ?? null} missing="Esta receita só foi publicada a partir de 2000." />
                    <RevenueCell tone="debt" amount={row.netDebt} previous={previous?.netDebt ?? null} missing="Esta dívida só foi publicada a partir de 2000." />
                    <RevenueCell tone="debt" amount={row.consolidatedDebt} previous={previous?.consolidatedDebt ?? null} missing="Este saldo só foi publicado a partir de 2014." />
                    <IndexerCell indexer={row.indexer} />
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{ratio(row.netDebtRatio)}</td>
                  </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      </div>
      {series.partial && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/80">{series.partial.label}: </span>
          dívida consolidada {billions(series.partial.consolidatedDebt)}, dívida líquida {billions(series.partial.netDebt)} ({ratio(series.partial.netDebtRatio)} da receita corrente líquida), receita corrente arrecadada {billions(series.partial.currentRevenue)}. {series.partial.note}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground/75">
        {series.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline-offset-4 hover:underline hover:text-sky-700 dark:hover:text-sky-300">
            {source.label}
            <ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </div>
  )
}
