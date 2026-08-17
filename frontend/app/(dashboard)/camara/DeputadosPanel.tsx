'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { VotePill } from '@/components/VotePill'
import { countByParty, countByState, PartyFilter, StateFilter } from '@/components/PartyFilter'
import { cn } from '@/lib/utils'
import { formatSessionDate } from '@/lib/legislativeFormat'
import { deputyService } from '@/services/deputyService'
import type { DeputiesPayload, DeputyDetail, DeputySummary, DeputyVoteRow } from '@/types/deputy'

function ChoiceBar({ deputy }: { deputy: DeputySummary }) {
  const { choices, recordedVoteCount } = deputy.record
  if (recordedVoteCount === 0) return <p className="text-xs text-muted-foreground">Sem escolha publicada em 2026.</p>
  const pct = (value: number) => `${(100 * value) / recordedVoteCount}%`

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={`${recordedVoteCount} votos publicados`}>
      <span className="bg-sky-500/80 dark:bg-sky-400/70" style={{ width: pct(choices.yes) }} />
      <span className="bg-violet-500/75 dark:bg-violet-400/70" style={{ width: pct(choices.no) }} />
      <span className="bg-slate-400/70" style={{ width: pct(choices.abstention + choices.obstruction) }} />
    </div>
  )
}

function DeputyCard({ deputy, selected, onSelect }: { deputy: DeputySummary; selected: boolean; onSelect: () => void }) {
  const { choices, recordedVoteCount, presidedCount } = deputy.record
  const other = choices.abstention + choices.obstruction

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full flex-col gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-sky-300 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/25' : 'bg-card hover:bg-muted/40'
      )}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto oficial servida pela Câmara */}
        {deputy.photoUrl && <img src={deputy.photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <span className="font-semibold tracking-[-0.01em]">{deputy.name}</span>
          <p className="mt-0.5 text-xs text-muted-foreground">{deputy.party ?? 'sem partido'} · {deputy.state ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ChoiceBar deputy={deputy} />
        <p className="text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{recordedVoteCount}</span> votos publicados · {choices.yes} sim · {choices.no} não
          {other > 0 && <> · {other} outros</>}
        </p>
        {presidedCount > 0 && <p className="text-[11px] text-muted-foreground">Presidiu {presidedCount} {presidedCount === 1 ? 'votação' : 'votações'} sem votar (Artigo 17).</p>}
      </div>
    </button>
  )
}

function PropositionLinks({ row }: { row: DeputyVoteRow }) {
  if (row.propositions.length === 0) return <span className="text-[11px] text-muted-foreground">Sem proposição afetada publicada.</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {row.propositions.map((proposition) => (
        <a
          key={proposition.id}
          href={proposition.officialPageUrl}
          target="_blank"
          rel="noreferrer"
          title={proposition.summary ?? undefined}
          className="inline-flex items-center gap-1 text-xs font-semibold underline decoration-border underline-offset-2 hover:decoration-foreground"
        >
          {proposition.title ?? `Proposição ${proposition.id}`} <ExternalLink className="size-3" />
        </a>
      ))}
    </div>
  )
}

function VoteRow({ row }: { row: DeputyVoteRow }) {
  return (
    <li className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 sm:w-52">
        <VotePill vote={row.vote} sourceName="Câmara dos Deputados" />
        <span className="text-xs tabular-nums text-muted-foreground">{formatSessionDate(row.date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <PropositionLinks row={row} />
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{row.description ?? 'Sem descrição publicada.'}</p>
        {row.partyAtTime && <p className="mt-1 text-[11px] text-muted-foreground">Partido no registro: {row.partyAtTime}</p>}
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/80">
          Placar publicado: {row.tally.yes} sim · {row.tally.no} não · {row.tally.abstention} abstenção · {row.tally.obstruction} obstrução
        </p>
      </div>
      {row.officialUrl && (
        <a href={row.officialUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          Fonte oficial <ExternalLink className="size-3" />
        </a>
      )}
    </li>
  )
}

function DetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const [detail, setDetail] = useState<DeputyDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDetail(null)
    setError(null)
    deputyService
      .getDeputy(id)
      .then((data) => {
        if (active) setDetail(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o retrospecto deste deputado.')
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-[-0.01em]">{detail?.name ?? 'Carregando…'}</h2>
          {detail && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.votes.length} posições publicadas em votações nominais de 2026 ·{' '}
              <a href={detail.officialPageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">página oficial</a>
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar retrospecto" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </header>
      {error && <p className="p-4 text-sm text-muted-foreground">{error}</p>}
      {!detail && !error && <p className="p-4 text-sm text-muted-foreground">Carregando o voto a voto…</p>}
      {detail && detail.votes.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma posição individual publicada em 2026.</p>}
      {detail && detail.votes.length > 0 && <ul className="max-h-[32rem] overflow-y-auto">{detail.votes.map((row) => <VoteRow key={row.votingId} row={row} />)}</ul>}
    </section>
  )
}

export function DeputadosPanel() {
  const [payload, setPayload] = useState<DeputiesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [party, setParty] = useState<string | null>(null)
  const [state, setState] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    deputyService
      .getDeputies()
      .then((data) => {
        if (active) setPayload(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os deputados. A fonte da Câmara pode estar fora do ar.')
      })
    return () => {
      active = false
    }
  }, [])

  const parties = useMemo(() => {
    const deputies = payload?.deputies ?? []
    const allParties = countByParty(deputies)
    if (!state) return allParties
    const stateCounts = new Map(countByParty(deputies.filter((deputy) => deputy.state === state)).map(({ party: itemParty, count }) => [itemParty, count] as const))
    return allParties
      .map(({ party: itemParty }) => ({ party: itemParty, count: stateCounts.get(itemParty) ?? 0 }))
      .sort((a, b) => (b.count - a.count) || a.party.localeCompare(b.party, 'pt-BR'))
  }, [payload, state])
  const states = useMemo(() => {
    const deputies = payload?.deputies ?? []
    const allStates = countByState(deputies)
    if (!party) return allStates
    const partyCounts = new Map(countByState(deputies.filter((deputy) => deputy.party === party)).map(({ state: itemState, count }) => [itemState, count] as const))
    return allStates.map(({ state: itemState }) => ({ state: itemState, count: partyCounts.get(itemState) ?? 0 }))
  }, [party, payload])
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (payload?.deputies ?? [])
      .filter((deputy) => (state ? deputy.state === state : true))
      .filter((deputy) => (party ? deputy.party === party : true))
      .filter((deputy) => !term || `${deputy.name} ${deputy.party ?? ''} ${deputy.state ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [party, payload, query, state])

  return (
    <div className="flex flex-col gap-4">
      {payload && (
        <p className="text-xs text-muted-foreground">
          {payload.deputies.length} deputados em exercício · {payload.coverage.votingCount} votações nominais do Plenário em {payload.coverage.year}
          {payload.coverage.lastDate && <> · dados até {formatSessionDate(payload.coverage.lastDate)}</>}
        </p>
      )}

      <div className="rounded-lg border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, partido ou estado" className="pl-9" aria-label="Buscar deputado" />
        </div>
      </div>

      {(states.length > 0 || parties.length > 0) && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          {states.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Estado</p>
              <StateFilter states={states} selected={state} onSelect={setState} />
            </div>
          )}
          {parties.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Partido</p>
              <PartyFilter parties={parties} selected={party} onSelect={setParty} />
            </div>
          )}
        </div>
      )}
      {error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{error}</div>}
      {!payload && !error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Lendo os dados oficiais da Câmara…</div>}
      {selected !== null && <DetailPanel id={selected} onClose={() => setSelected(null)} />}
      {payload && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((deputy) => <DeputyCard key={deputy.id} deputy={deputy} selected={selected === deputy.id} onSelect={() => setSelected(selected === deputy.id ? null : deputy.id)} />)}</div>}
      {payload && visible.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum deputado encontrado para esse filtro.</p>}
    </div>
  )
}
