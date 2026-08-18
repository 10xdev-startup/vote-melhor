'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysBetweenDates, formatSessionDate } from '@/lib/legislativeFormat'
import { legislativeJourneyService } from '@/services/legislativeJourneyService'
import type { LegislativeJourney, LegislativeJourneyCurrentWait, LegislativeJourneyStep } from '@/types/legislativeJourney'

function formatStatus(value: string | null): string {
  if (!value) return 'Situação não publicada'
  const lower = value.toLocaleLowerCase('pt-BR')
  return `${lower.charAt(0).toLocaleUpperCase('pt-BR')}${lower.slice(1)}`
}

function CurrentWait({ wait }: { wait: LegislativeJourneyCurrentWait }) {
  return (
    <div className="mt-3 border-t border-amber-300/50 pt-3 dark:border-amber-900/50">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border bg-background/70 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">O que falta agora</p>
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-foreground">
            {wait.nextAction} pelo {wait.responsible.role.toLocaleLowerCase('pt-BR')},{' '}
            <a href={wait.responsible.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground">
              {wait.responsible.name} ({wait.responsible.party}-{wait.responsible.state}) <ExternalLink className="size-2.5" />
            </a>
          </p>
        </div>
        <div className="rounded border bg-background/70 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Prazo regimental</p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground">{wait.deadline.description}. <strong>{wait.deadline.started ? 'Prazo em andamento.' : 'O prazo ainda não começou.'}</strong></p>
          <a href={wait.deadline.sourceUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Regimento do Senado, art. 356 <ExternalLink className="size-2.5" />
          </a>
        </div>
      </div>

      <details open className="mt-2 rounded border bg-background/50 px-3 py-2.5">
        <summary className="cursor-pointer text-[11px] font-semibold text-foreground">Entenda por que ainda não avançou</summary>
        <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">{wait.formalReasonPublished ? 'Há uma justificativa formal publicada no processo.' : 'Não há justificativa formal publicada para a espera.'}</strong>{' '}
            A tramitação registra a matéria aguardando despacho desde {formatSessionDate(wait.since)}.{' '}
            <a href={wait.processSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">Ver processo oficial <ExternalLink className="size-2.5" /></a>
          </p>
          <p className="mt-2 font-semibold text-foreground">Contexto público documentado</p>
          <ul className="mt-1.5 space-y-2">
            {wait.publicContext.map((item) => (
              <li key={item.date} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                <span className="tabular-nums">{formatSessionDate(item.date)}</span>
                <span>{item.description}{' '}<a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Fonte oficial de ${formatSessionDate(item.date)}`} className="inline-flex text-muted-foreground underline underline-offset-2 hover:text-foreground">fonte <ExternalLink className="ml-1 size-2.5" /></a></span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}

function Step({ step, index, last, wait, outcomes }: { step: LegislativeJourneyStep; index: number; last: boolean; wait: LegislativeJourneyCurrentWait | null; outcomes: LegislativeJourney['outcomes'] }) {
  const dateLabel = step.date
    ? `${step.state === 'current' ? 'desde ' : ''}${formatSessionDate(step.date)}`
    : step.state === 'pending'
      ? 'Sem data publicada'
      : null
  return (
    <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-3 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute bottom-0 left-[0.72rem] top-6 w-px bg-border" />}
      <span className={cn('relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-[10px] font-bold', step.state === 'current' ? 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : step.state === 'completed' ? 'border-sky-400 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' : 'text-muted-foreground')}>{step.state === 'completed' ? '✓' : index + 1}</span>
      <div className={cn('rounded-md border px-3 py-2.5', step.state === 'current' ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30' : step.state === 'completed' ? 'border-sky-300/60 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20' : 'bg-muted/20 text-muted-foreground')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-semibold">{step.label}</span>
          {dateLabel && <span className="text-[10px] tabular-nums text-muted-foreground">{dateLabel}</span>}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
        {step.facts.length > 0 && (
          <dl className={cn('mt-2 grid gap-1.5', step.facts.length === 1 ? 'grid-cols-1' : step.facts.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
            {step.facts.map((fact) => (
              <div key={fact.label} className="rounded border bg-background/70 px-2.5 py-2">
                <dt className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                  {fact.sourceUrl ? (
                    <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground">
                      {fact.kind === 'date' ? formatSessionDate(fact.value) : fact.value} <ExternalLink className="size-2.5" />
                    </a>
                  ) : fact.kind === 'date' ? formatSessionDate(fact.value) : fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {step.id === 'outcome' && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <div key={outcome.condition} className="rounded border bg-background/70 px-2.5 py-2">
                <p className="text-[10px] font-semibold text-foreground">{outcome.condition}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{outcome.result}</p>
              </div>
            ))}
          </div>
        )}
        {wait && <CurrentWait wait={wait} />}
      </div>
    </li>
  )
}

function JourneyView({ journey }: { journey: LegislativeJourney }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/10 p-3">
      <ol aria-label="Etapas da tramitação" className="flex flex-col">
        {journey.steps.map((step, index) => <Step key={step.id} step={step} index={index} last={index === journey.steps.length - 1} wait={journey.currentWait?.stepId === step.id ? journey.currentWait : null} outcomes={journey.outcomes} />)}
      </ol>

      <p className="text-[11px] text-muted-foreground">
        Fonte atualizada em {formatSessionDate(journey.sourceUpdatedAt)} ·{' '}
        <a href={journey.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">tramitação oficial <ExternalLink className="size-3" /></a>
        {journey.documentUrl && <>{' · '}<a href={journey.documentUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">texto enviado ao Senado</a></>}
      </p>
    </div>
  )
}

export function LegislativeJourneyTabs({ journeyId, votingCount, children }: { journeyId: string; votingCount: number; children: ReactNode }) {
  const [journey, setJourney] = useState<LegislativeJourney | null>(null)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'votings' | 'journey'>('votings')
  const baseId = useId()
  const waitingDays = journey?.currentWait ? daysBetweenDates(journey.currentWait.since, journey.collectedAt) : null

  useEffect(() => {
    let active = true
    legislativeJourneyService
      .getJourney(journeyId)
      .then((data) => {
        if (active) setJourney(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [journeyId])

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Situação atual:{' '}
        <span className="font-semibold text-foreground">
          {journey ? `Senado · ${formatStatus(journey.currentStatus)}${waitingDays !== null ? ` há ${waitingDays} dias` : ''}` : error ? 'tramitação indisponível' : 'consultando o Senado…'}
        </span>
        {journey?.currentStatusAt && <> · desde {formatSessionDate(journey.currentStatusAt)}</>}
      </p>

      <div role="tablist" aria-label="Detalhes da proposição" className="flex w-fit rounded-lg border bg-muted/40 p-1">
        <button id={`${baseId}-votings-tab`} type="button" role="tab" aria-selected={activeTab === 'votings'} aria-controls={`${baseId}-votings-panel`} onClick={() => setActiveTab('votings')} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition-colors', activeTab === 'votings' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          Votações ({votingCount})
        </button>
        <button id={`${baseId}-journey-tab`} type="button" role="tab" aria-selected={activeTab === 'journey'} aria-controls={`${baseId}-journey-panel`} onClick={() => setActiveTab('journey')} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition-colors', activeTab === 'journey' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          Tramitação
        </button>
      </div>

      <div id={`${baseId}-${activeTab}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${activeTab}-tab`}>
        {activeTab === 'votings' && children}
        {activeTab === 'journey' && journey && <JourneyView journey={journey} />}
        {activeTab === 'journey' && !journey && !error && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Consultando a tramitação oficial…</p>}
        {activeTab === 'journey' && error && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Não foi possível consultar a tramitação no Senado.</p>}
      </div>
    </div>
  )
}
