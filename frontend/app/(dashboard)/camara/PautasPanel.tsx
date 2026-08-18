'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { countByParty, PartyFilter } from '@/components/PartyFilter'
import { VotePill } from '@/components/VotePill'
import { countThemesInTexts, LEGISLATIVE_THEMES, matchesTheme, normalizeForSearch } from '@/lib/legislativeThemes'
import { cn } from '@/lib/utils'
import { formatSessionDate } from '@/lib/legislativeFormat'
import { camaraVotingService } from '@/services/camaraVotingService'
import type { CamaraPropositionGroup, CamaraVotingDeputyVote, CamaraVotingDetail, CamaraVotingResult, CamaraVotingSummary } from '@/types/camaraVoting'
import { LegislativeJourneyTabs } from './LegislativeJourneyTabs'

const RESULT_LABEL: Record<Exclude<CamaraVotingResult, null>, string> = { approved: 'Aprovada', rejected: 'Rejeitada' }
const CONTESTED_COLOR = 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
const CONTESTED_CLASS = cn('rounded-full border px-2 py-px text-[10px] font-semibold', CONTESTED_COLOR)

function ResultPill({ result }: { result: CamaraVotingResult }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border bg-muted/40 px-2 py-px text-[10px] font-semibold text-muted-foreground">
      {result === null ? 'Resultado não publicado' : RESULT_LABEL[result]}
    </span>
  )
}

function TallyBar({ voting }: { voting: CamaraVotingSummary }) {
  const { tally } = voting
  if (tally.totalPublished === 0) return null
  const pct = (value: number) => `${(100 * value) / tally.totalPublished}%`
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={`${tally.totalPublished} posições publicadas`}>
      <span className="bg-sky-500/80 dark:bg-sky-400/70" style={{ width: pct(tally.yes) }} />
      <span className="bg-violet-500/75 dark:bg-violet-400/70" style={{ width: pct(tally.no) }} />
      <span className="bg-slate-400/70" style={{ width: pct(tally.abstention + tally.obstruction + tally.notEligible + tally.unclassified) }} />
    </div>
  )
}

function VotingRow({ voting, selected, onSelect }: { voting: CamaraVotingSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-sky-300 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30' : 'border-transparent bg-muted/30 hover:bg-muted/60'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ResultPill result={voting.result} />
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatSessionDate(voting.date)}</span>
        {voting.contested && <span className={CONTESTED_CLASS}>Decidida no fio</span>}
      </div>
      <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{voting.description ?? 'Sem descrição publicada.'}</p>
      <TallyBar voting={voting} />
      <p className="text-[11px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{voting.tally.yes}</span> sim ·{' '}
        <span className="font-semibold text-foreground">{voting.tally.no}</span> não · {voting.tally.abstention} abstenção · {voting.tally.obstruction} obstrução
      </p>
    </button>
  )
}

function PropositionCard({ group, selectedId, onSelect }: { group: CamaraPropositionGroup; selectedId: string | null; onSelect: (id: string) => void }) {
  const proposition = group.proposition
  const votings = (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {group.votings.length === 1 ? '1 votação' : `${group.votings.length} votações, na ordem em que aconteceram`}
      </p>
      {group.votings.map((voting) => <VotingRow key={voting.id} voting={voting} selected={selectedId === voting.id} onSelect={() => onSelect(voting.id)} />)}
    </div>
  )
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{proposition?.title ?? 'Votação sem proposição afetada'}</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{formatSessionDate(group.lastDate)}</span>
          {group.contestedCount > 0 && <span className={CONTESTED_CLASS}>{group.contestedCount} decidida{group.contestedCount > 1 ? 's' : ''} no fio</span>}
          {proposition && (
            <a href={proposition.officialPageUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
              Proposição oficial <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {group.authors.length > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {group.authors.length === 1 ? 'Autor: ' : 'Autores: '}
            {group.authors.map((author, index) => (
              <span key={author.name}>
                {index > 0 && ', '}
                <a href={author.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground">
                  {author.name}{author.party && ` (${author.party}${author.state ? `-${author.state}` : ''})`} <ExternalLink className="size-2.5" />
                </a>
              </span>
            ))}
          </p>
        )}
        {group.popularNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.popularNames.map((popularName) => (
              <a
                key={popularName.label}
                href={popularName.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`${popularName.label} — nome usado pela Câmara`}
              >
                {popularName.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[13px] leading-relaxed">{proposition?.summary ?? 'A Câmara não publicou uma proposição afetada para esta votação.'}</p>
      </div>
      {group.journeyId ? <LegislativeJourneyTabs journeyId={group.journeyId} votingCount={group.votings.length}>{votings}</LegislativeJourneyTabs> : votings}
    </article>
  )
}

function groupVotes(votes: CamaraVotingDeputyVote[]): Array<{ label: string; rows: CamaraVotingDeputyVote[] }> {
  const groups: Array<{ label: string; rows: CamaraVotingDeputyVote[] }> = []
  for (const row of votes) {
    const label = row.vote.category === 'voted' ? row.vote.label : row.vote.category === 'not_eligible' ? 'Presidiu a sessão' : row.vote.label
    const last = groups.at(-1)
    if (last?.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  }
  return groups
}

function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  // Guarda o `id` junto com o resultado e deriva o que a tela mostra. Resetar por
  // `setState` no corpo do effect dispara render em cascata (react-hooks/set-state-in-effect).
  const [loaded, setLoaded] = useState<{ id: string; detail: CamaraVotingDetail | null; error: string | null } | null>(null)
  // O filtro de partido tambem carrega o `id`: trocar de pauta limpa a selecao por derivacao,
  // sem precisar de um `setParty(null)` no effect.
  const [partyFilter, setPartyFilter] = useState<{ id: string; value: string | null } | null>(null)

  useEffect(() => {
    let active = true
    camaraVotingService
      .getVoting(id)
      .then((data) => {
        if (active) setLoaded({ id, detail: data, error: null })
      })
      .catch(() => {
        if (active) setLoaded({ id, detail: null, error: 'Não foi possível carregar os votos desta pauta.' })
      })
    return () => {
      active = false
    }
  }, [id])

  const current = loaded?.id === id ? loaded : null
  const detail = current?.detail ?? null
  const error = current?.error ?? null
  const party = partyFilter?.id === id ? partyFilter.value : null
  const setParty = (value: string | null) => setPartyFilter({ id, value })

  const parties = useMemo(() => countByParty(detail?.votes ?? []), [detail])
  const visible = useMemo(() => (detail?.votes ?? []).filter((row) => (party ? row.party === party : true)), [detail, party])
  const groups = useMemo(() => groupVotes(visible), [visible])

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold tracking-[-0.01em]">{detail?.propositions.map((item) => item.title ?? `Proposição ${item.id}`).join(' + ') ?? 'Carregando…'}</h2>
            {detail && <ResultPill result={detail.result} />}
          </div>
          {detail && (
            <>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{detail.description ?? 'Sem descrição publicada.'}</p>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {formatSessionDate(detail.date)} · {detail.tally.totalPublished} posições publicadas · {detail.tally.yes} sim · {detail.tally.no} não
                {detail.officialUrl && <>{' · '}<a href={detail.officialUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">fonte oficial</a></>}
              </p>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar pauta" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
      </header>

      {error && <p className="p-4 text-sm text-muted-foreground">{error}</p>}
      {!detail && !error && <p className="p-4 text-sm text-muted-foreground">Carregando os votos…</p>}
      {detail && (
        <>
          <div className="border-b px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Partido na data do voto</p>
            <PartyFilter parties={parties} selected={party} onSelect={setParty} />
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="sticky top-0 z-10 border-b bg-muted/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">{group.label} · {group.rows.length}</p>
                <ul className="grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.rows.map((row, index) => (
                    <li key={`${row.deputyId ?? row.name ?? 'sem-nome'}-${index}`} className="flex min-w-0 items-center gap-3 border-b px-4 py-2">
                      <VotePill vote={row.vote} sourceName="Câmara dos Deputados" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{row.name ?? 'Sem nome'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{row.party ?? 'sem partido'} · {row.state ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {visible.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma posição publicada para esse partido.</p>}
          </div>
        </>
      )}
    </section>
  )
}

export function PautasPanel() {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof camaraVotingService.getVotings>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<string | null>(null)
  const [onlyContested, setOnlyContested] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    camaraVotingService
      .getVotings()
      .then((data) => {
        if (active) setPayload(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar as pautas. A fonte da Câmara pode estar fora do ar.')
      })
    return () => {
      active = false
    }
  }, [])

  const themeCounts = useMemo(
    () => countThemesInTexts((payload?.propositions ?? []).map((group) => `${group.proposition?.title ?? ''} ${group.proposition?.summary ?? ''}`)),
    [payload]
  )
  const visible = useMemo(() => {
    const term = normalizeForSearch(query.trim())
    const activeTheme = LEGISLATIVE_THEMES.find((item) => item.id === theme)
    return (payload?.propositions ?? [])
      .filter((group) => (onlyContested ? group.contestedCount > 0 : true))
      .filter((group) => (activeTheme ? matchesTheme(`${group.proposition?.title ?? ''} ${group.proposition?.summary ?? ''}`, activeTheme) : true))
      .filter((group) => {
        if (!term) return true
        const text = `${group.proposition?.title ?? ''} ${group.proposition?.summary ?? ''} ${group.popularNames.map((item) => item.label).join(' ')} ${group.votings.map((item) => item.description ?? '').join(' ')}`
        return normalizeForSearch(text).includes(term)
      })
  }, [onlyContested, payload, query, theme])

  return (
    <div className="flex flex-col gap-4">
      {payload && (
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          <p>{payload.coverage.propositionCount} proposições em {payload.coverage.votingCount} votações nominais do Plenário em {payload.coverage.year}{payload.coverage.lastDate && <> · dados até {formatSessionDate(payload.coverage.lastDate)}</>}.</p>
          {payload.coverage.relationCount > payload.coverage.votingCount && <p className="rounded-lg border border-dashed px-3 py-2">São {payload.coverage.relationCount} relações: quando uma votação afeta duas proposições, ela aparece nos dois agrupamentos. Nenhuma é tratada como principal.</p>}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por proposição, ementa ou votação" className="pl-9" aria-label="Buscar pauta da Câmara" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {LEGISLATIVE_THEMES.filter((item) => (themeCounts[item.id] ?? 0) > 0).map((item) => {
            const count = themeCounts[item.id] ?? 0
            const active = theme === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(active ? null : item.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
                )}
              >
                {item.label} <span className="font-normal opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            onClick={() => setOnlyContested((previous) => !previous)}
            aria-pressed={onlyContested}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              onlyContested ? CONTESTED_COLOR : 'bg-card text-muted-foreground hover:bg-muted/60'
            )}
          >
            Só as decididas no fio ({payload?.coverage.contestedPropositionCount ?? 0})
          </button>
          {payload && <p className="text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? 'pauta encontrada' : 'pautas encontradas'}</p>}
        </div>
      </div>

      {onlyContested && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Pautas com ao menos uma votação decidida por menos de 10% de diferença entre Sim e Não, com no mínimo 20 votos decisivos.
        </p>
      )}

      {error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{error}</div>}
      {!payload && !error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Lendo as votações na Câmara…</div>}
      {selected !== null && <DetailPanel id={selected} onClose={() => setSelected(null)} />}
      {payload && <div className="grid grid-cols-1 gap-3">{visible.map((group) => <PropositionCard key={group.proposition?.id ?? group.votings[0]?.id} group={group} selectedId={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />)}</div>}
      {payload && visible.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhuma pauta encontrada para essa busca.</p>}
    </div>
  )
}
