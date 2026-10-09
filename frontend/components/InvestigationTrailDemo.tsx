'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChartNoAxesCombined, CheckCircle2, ChevronDown, CircleDashed, FileText, FlaskConical, ListOrdered, Search, Table2 } from 'lucide-react'
import { InvestigationTrailChartsDemo } from '@/components/InvestigationTrailChartsDemo'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DEMO_SOURCES, DEMO_TRAILS } from '@/data/investigationTrailDemo'
import { cn } from '@/lib/utils'
import type { InvestigationSource, InvestigationStatus, InvestigationStep } from '@/types/investigationTrail'

const STATUS: Record<InvestigationStatus, { label: string; color: string }> = {
  identified: { label: 'Fonte identificada', color: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300' },
  documented: { label: 'Documentação localizada', color: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  tested: { label: 'Acesso testado', color: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  consulted: { label: 'Dados consultados', color: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  unavailable: { label: 'Acesso pendente', color: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
}

function StepCard({ step, sources, number, year }: { step: InvestigationStep; sources: InvestigationSource[]; number: number; year: number }) {
  const [expanded, setExpanded] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const status = STATUS[step.status]
  const covered = step.coverage.includes(year)
  const canPreview = covered && step.sample !== undefined
  const detailsId = `trail-details-${step.id}`

  return (
    <article aria-labelledby={`trail-title-${step.id}`} className="w-full min-w-0 overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-xs font-semibold tabular-nums text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">{String(number).padStart(2, '0')}</span>
            <div className="min-w-0">
              <h3 id={`trail-title-${step.id}`} className="text-base font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">{step.question}</p>
            </div>
          </div>
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-medium', status.color)}>Exemplo: {status.label}</span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.purpose}</p>
        <div className="mt-3 space-y-2 rounded-md bg-muted/30 px-3 py-2">
          {sources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{source.organization}</p>
                <p className="mt-0.5 text-sm font-medium">{source.title}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">{source.access.map((access) => <span key={access} className="rounded border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{access}</span>)}</div>
            </div>
          ))}
        </div>

        <p className={cn('mt-2 text-xs', covered ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
          {covered ? `Cobertura de exemplo: ${year}${year === 2026 ? ' · exercício parcial' : ''}` : step.coverage.length === 0 ? 'Exemplo de lacuna: acesso ainda pendente. A pergunta permanece na trilha.' : `Sem cobertura de exemplo para ${year}. Anos disponíveis: ${step.coverage.join(', ')}.`}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sources.map((source) => <a key={source.id} href={source.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted">Abrir {sources.length === 1 ? 'fonte oficial' : source.title}<ArrowUpRight className="size-3.5" /></a>)}
          <button type="button" disabled={!canPreview} onClick={() => setPreviewOpen(true)} title={canPreview ? 'Abrir uma amostra ilustrativa' : 'Esta etapa não tem prévia neste exemplo'} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"><Table2 className="size-3.5" />Ver dados de exemplo</button>
          <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"><FileText className="size-3.5" />Documentação<ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} /></button>
        </div>
      </div>

      {expanded && <div id={detailsId} className="space-y-4 border-t bg-muted/20 p-4 text-xs leading-relaxed">
        <div><h4 className="font-semibold">Como consultar</h4>{sources.map((source) => <div key={source.id} className="mt-2"><p className="font-medium">{source.title}</p><p className="mt-1 text-muted-foreground">{source.instructions}</p>{source.endpoint && <code className="mt-2 block overflow-x-auto rounded-md border bg-background p-3 text-[11px]">{source.endpoint}</code>}</div>)}</div>
        <div><h4 className="font-semibold">Campos a investigar</h4><p className="mt-1 text-muted-foreground">{step.fields.join(' · ')}</p><p className="mt-1 text-muted-foreground">São conceitos do exemplo, não um schema validado. Parâmetros, paginação, limites e autenticação precisam ser conferidos na fonte.</p></div>
        <div><h4 className="font-semibold">Conexão com outras informações</h4><p className="mt-1 text-muted-foreground">{step.connection}</p></div>
        <div className="rounded-md border bg-background p-3"><p className="font-medium">Última verificação: não executada neste protótipo.</p><p className="mt-1 text-muted-foreground">O estado do card é ilustrativo. Abrir um link não verifica a fonte nem altera seu status.</p></div>
      </div>}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Prévia ilustrativa · {step.title}</DialogTitle><DialogDescription>Exemplo para validar a visualização. Não contém registros consultados nem valores financeiros reais.</DialogDescription></DialogHeader>
          {step.sample && <div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{step.sample.columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{step.sample.rows.map((row, index) => <tr key={index} className="border-t">{row.map((cell, column) => <td key={column} className="px-3 py-2 text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table></div>}
        </DialogContent>
      </Dialog>
    </article>
  )
}

export function InvestigationTrailDemo() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [selectedId, setSelectedId] = useState(DEMO_TRAILS[0]!.id)
  const [year, setYear] = useState(2023)
  const [view, setView] = useState<'trail' | 'charts'>('trail')
  const results = useMemo(() => {
    // localeCompare evita retirar acentos do texto exibido ou depender de um novo motor de busca.
    const ignored = new Set(['a', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'como', 'quanto', 'quem', 'sao', 'são'])
    const terms = submittedQuery.toLocaleLowerCase('pt-BR').replace(/[?.,!]/g, '').split(/\s+/).filter((term) => term && !ignored.has(term))
    return DEMO_TRAILS.filter((trail) => {
      const words = [trail.title, trail.question, trail.territory, ...trail.searchTerms, ...trail.steps.map((step) => step.title)].join(' ').toLocaleLowerCase('pt-BR').split(/\s+/)
      return terms.every((term) => words.some((word) => word.includes(term) || word.localeCompare(term, 'pt-BR', { sensitivity: 'base' }) === 0))
    })
  }, [submittedQuery])
  const trail = results.find((candidate) => candidate.id === selectedId) ?? results[0]

  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmittedQuery(query) }

  return (
    <div id="trails-panel" role="tabpanel" aria-labelledby="trails-tab" className="mx-auto mt-6 w-full max-w-5xl">
      <div className="mb-7 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"><FlaskConical className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-semibold">Simulação para validar a experiência</p><p className="mt-1 text-xs leading-relaxed opacity-80">Perguntas e fontes de referência, com estados e cobertura ilustrativos. As buscas desta aba não consultam APIs nem verificam os dados.</p></div></div>
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Explorar dados públicos</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">O que você quer descobrir?</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Encontre as fontes e os passos para investigar uma pergunta.</p></div>
      <form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Pergunta da investigação" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Quanto Minas arrecada, gasta e deve?" className="h-12 bg-card pl-10 text-sm" /></div><button type="submit" className="rounded-md bg-sky-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-800">Buscar exemplos</button></form>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Escolher exemplo de investigação">{results.map((example) => <button key={example.id} type="button" aria-pressed={trail?.id === example.id} onClick={() => setSelectedId(example.id)} className={cn('rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted', trail?.id === example.id && 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200')}>{example.title}<span className="ml-2 text-[10px] opacity-65">{example.steps.length} etapas</span></button>)}</div>

      {!trail ? <div className="mt-8 rounded-xl border border-dashed p-8 text-center"><CircleDashed className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">Nenhum exemplo para esta pergunta</h2><p className="mt-2 text-xs text-muted-foreground">Tente receita, dívida, Minas ou Brasil. O protótipo não cria uma investigação sem fontes.</p><button type="button" onClick={() => { setQuery(''); setSubmittedQuery('') }} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-300"><ArrowLeft className="size-3" />Ver todos os exemplos</button></div> : <div className="mt-8">
        <div role="tablist" aria-label="Visualização da investigação" className="mb-3 inline-flex gap-1 rounded-lg bg-muted/60 p-1" onKeyDown={(event) => {
          const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
          if (!keys.includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'trail' : event.key === 'End' ? 'charts' : view === 'trail' ? 'charts' : 'trail'
          setView(next)
          event.currentTarget.querySelector<HTMLButtonElement>(`#investigation-${next}-tab`)?.focus()
        }}>
          {(['trail', 'charts'] as const).map((value) => <button key={value} id={`investigation-${value}-tab`} type="button" role="tab" aria-selected={view === value} aria-controls={`investigation-${value}-panel`} tabIndex={view === value ? 0 : -1} onClick={() => setView(value)} className={cn('flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground', view === value && 'bg-card text-foreground shadow-sm')}>{value === 'trail' ? <ListOrdered className="size-4" /> : <ChartNoAxesCombined className="size-4" />}{value === 'trail' ? 'Trilha' : 'Gráficos'}</button>)}
        </div>
        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="selected-trail-title">
        <div className="border-b bg-sky-50/40 p-4 dark:bg-sky-950/20 sm:p-5"><h2 id="selected-trail-title" className="text-xl font-semibold tracking-tight">{trail.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{trail.description}</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full border bg-background px-3 py-1.5 text-xs">{trail.territory}</span><label className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">Exercício<select aria-label="Exercício da investigação" value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-transparent py-0.5 outline-offset-2">{[2023, 2024, 2025, 2026].map((value) => <option key={value} value={value}>{value}{value === 2026 ? ' (parcial)' : ''}</option>)}</select></label><span className="rounded-full bg-background px-3 py-1.5 text-xs font-medium" aria-label="Quantidade de etapas">{trail.steps.length} etapas</span></div><p className="mt-3 text-xs text-muted-foreground">Ordem sugerida. Você pode abrir qualquer etapa, sem concluir as anteriores.</p></div>
        <div id="investigation-trail-panel" role="tabpanel" aria-labelledby="investigation-trail-tab" hidden={view !== 'trail'} tabIndex={0}>
        <ol className="divide-y" aria-label="Etapas da investigação">
          {trail.steps.map((step, index) => (
            <li key={`${trail.id}-${step.id}`} className="w-full">
              <StepCard step={step} sources={step.sourceIds.map((id) => DEMO_SOURCES[id]!)} number={index + 1} year={year} />
            </li>
          ))}
        </ol>
        <div className="border-t bg-muted/20 p-4 sm:p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-sky-700 dark:text-sky-300" /><h3 className="text-sm font-semibold">Conectando as informações</h3></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cada etapa indica conceitos, períodos e cuidados para cruzar suas fontes. A quantidade de passos acompanha a pergunta; a presença de um arquivo não garante que a resposta esteja pronta.</p><p className="mt-3 text-xs font-medium">Este exemplo organiza a investigação. Resultados e conclusões dependem da validação dos dados.</p></div>
        </div>
        <div id="investigation-charts-panel" role="tabpanel" aria-labelledby="investigation-charts-tab" hidden={view !== 'charts'} tabIndex={0}>
          {view === 'charts' && <InvestigationTrailChartsDemo key={trail.id} trail={trail} year={year} />}
        </div>
      </section></div>}
    </div>
  )
}
