'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { VotePill } from '@/components/VotePill'
import { countByParty, PartyFilter } from '@/components/PartyFilter'
import { cn } from '@/lib/utils'
import { formatRate, formatSessionDate } from '@/lib/senadoFormat'
import { senatorService } from '@/services/senatorService'
import type { SenatorDetail, SenatorSummary, SenatorVoteRow, SenatorsPayload } from '@/types/senator'

/**
 * Retrospecto de votação dos senadores em exercício.
 *
 * Duas regras que a tela nao pode quebrar:
 *
 * 1. **Nunca mostrar taxa sem denominador.** Cada senador tem um denominador proprio (na
 *    legislatura atual eles vao de 3 a 584), porque quem assumiu como suplente aparece em
 *    menos votacoes. "97%" sozinho compara coisas diferentes.
 * 2. **Cor nao julga.** `Sim` nao e verde e `Não` nao e vermelho — isso sugeriria que
 *    aprovar e bom e rejeitar e ruim. As cores separam, nao qualificam.
 */

/** Abaixo disso a taxa nao diz nada: o denominador e pequeno demais para comparar. */
const LOW_SAMPLE_THRESHOLD = 50

/** Barra de participacao. As tres faixas sempre somam `eligibleCount`. */
function RecordBar({ senator }: { senator: SenatorSummary }) {
  const { votedCount, presentNotVotedCount, absentCount, eligibleCount } = senator.record
  if (eligibleCount === 0) return <p className="text-xs text-muted-foreground">Sem votação nominal no período.</p>

  const pct = (value: number) => `${(100 * value) / eligibleCount}%`

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span className="bg-sky-500/80 dark:bg-sky-400/70" style={{ width: pct(votedCount) }} />
      <span className="bg-amber-400/80 dark:bg-amber-400/60" style={{ width: pct(presentNotVotedCount) }} />
      <span className="bg-muted-foreground/25" style={{ width: pct(absentCount) }} />
    </div>
  )
}

function SenatorCard({ senator, selected, onSelect }: { senator: SenatorSummary; selected: boolean; onSelect: () => void }) {
  const { record } = senator
  const lowSample = record.eligibleCount > 0 && record.eligibleCount < LOW_SAMPLE_THRESHOLD

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
        {/* eslint-disable-next-line @next/next/no-img-element -- foto oficial servida pelo dominio do Senado */}
        {senator.photoUrl && <img src={senator.photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-[-0.01em]">{senator.name}</span>
            {senator.onBallot && (
              <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                Na urna em outubro
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {senator.party ?? 'sem partido'} · {senator.state ?? '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <RecordBar senator={senator} />
        <p className="text-xs tabular-nums text-muted-foreground">
          {/* Denominador SEMPRE junto da taxa — sem ele a comparacao entre senadores mente. */}
          Votou <span className="font-semibold text-foreground">{record.votedCount}</span> de {record.eligibleCount}
          {record.eligibleCount > 0 && <> · {formatRate(record.participationRate)}</>}
        </p>
        {lowSample && <p className="text-[11px] text-amber-700 dark:text-amber-400">Poucas votações no período — a taxa não é comparável.</p>}
      </div>
    </button>
  )
}

function VoteRow({ row }: { row: SenatorVoteRow }) {
  return (
    <li className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 sm:w-52">
        <VotePill vote={row.vote} />
        <span className="text-xs tabular-nums text-muted-foreground">{formatSessionDate(row.date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {row.identification && <span className="text-xs font-semibold">{row.identification}</span>}
          {row.partyAtTime && <span className="text-[11px] text-muted-foreground">votou pelo {row.partyAtTime}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{row.summary ?? 'Sem ementa publicada.'}</p>
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/80">
          Placar: {row.tally.yes} sim · {row.tally.no} não · {row.tally.abstention} abstenção · {row.tally.absent} ausente
        </p>
      </div>
      {row.officialUrl && (
        <a
          href={row.officialUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Matéria oficial <ExternalLink className="size-3" />
        </a>
      )}
    </li>
  )
}

function DetailPanel({ code, onClose }: { code: number; onClose: () => void }) {
  // Guarda o `code` junto com o resultado e deriva o que a tela mostra. Resetar por
  // `setState` no corpo do effect dispara render em cascata (react-hooks/set-state-in-effect);
  // derivando, trocar de senador invalida o conteudo antigo sozinho.
  const [loaded, setLoaded] = useState<{ code: number; detail: SenatorDetail | null; error: string | null } | null>(null)

  useEffect(() => {
    let active = true

    senatorService
      .getSenator(code)
      .then((data) => {
        if (active) setLoaded({ code, detail: data, error: null })
      })
      .catch(() => {
        if (active) setLoaded({ code, detail: null, error: 'Não foi possível carregar o retrospecto deste senador.' })
      })

    return () => {
      active = false
    }
  }, [code])

  const current = loaded?.code === code ? loaded : null
  const detail = current?.detail ?? null
  const error = current?.error ?? null

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-[-0.01em]">{detail?.name ?? 'Carregando…'}</h2>
          {detail && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.votes.length} votações nominais em que pôde votar
              {detail.officialPageUrl && (
                <>
                  {' · '}
                  <a href={detail.officialPageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    página oficial
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar retrospecto" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </header>

      {error && <p className="p-4 text-sm text-muted-foreground">{error}</p>}
      {!detail && !error && <p className="p-4 text-sm text-muted-foreground">Carregando o voto a voto…</p>}
      {detail && detail.votes.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma votação nominal no período.</p>}
      {detail && detail.votes.length > 0 && (
        <ul className="max-h-[32rem] overflow-y-auto">
          {detail.votes.map((row) => (
            <VoteRow key={row.votacaoId} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function SenadoresPanel() {
  const [payload, setPayload] = useState<SenatorsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyBallot, setOnlyBallot] = useState(true)
  const [party, setParty] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    senatorService
      .getSenators()
      .then((data) => {
        if (active) setPayload(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os senadores. A API do Senado pode estar fora do ar.')
      })

    return () => {
      active = false
    }
  }, [])

  // O recorte "na urna" vem antes da contagem por partido: os chips precisam refletir o
  // conjunto que esta na tela, senao o numero ao lado da sigla nao bate com a lista.
  const inScope = useMemo(() => {
    if (!payload) return []
    return payload.senators.filter((senator) => (onlyBallot ? senator.onBallot : true))
  }, [payload, onlyBallot])

  const parties = useMemo(() => countByParty(inScope), [inScope])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return inScope
      .filter((senator) => (party ? senator.party === party : true))
      .filter((senator) => {
        if (!term) return true
        return `${senator.name} ${senator.party ?? ''} ${senator.state ?? ''}`.toLowerCase().includes(term)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [inScope, query, party])

  const ballotCount = payload?.senators.filter((senator) => senator.onBallot).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      {payload && (
        <p className="text-xs text-muted-foreground">
          {payload.coverage.votacaoCount} votações nominais de {payload.coverage.fromYear} a {payload.coverage.toYear}
          {payload.sourceVersion && <> · dado do Senado em {payload.sourceVersion}</>}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, partido ou estado"
            className="pl-9"
            aria-label="Buscar senador"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyBallot((previous) => !previous)}
          aria-pressed={onlyBallot}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
            onlyBallot
              ? 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
              : 'bg-card text-muted-foreground hover:bg-muted/60'
          )}
        >
          Só quem está na urna ({ballotCount})
        </button>
      </div>

      {parties.length > 0 && <PartyFilter parties={parties} selected={party} onSelect={setParty} />}

      {error && (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{error}</div>
      )}
      {!payload && !error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Lendo as votações no Senado…</div>}

      {selected !== null && <DetailPanel code={selected} onClose={() => setSelected(null)} />}

      {payload && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((senator) => (
            <SenatorCard
              key={senator.code}
              senator={senator}
              selected={selected === senator.code}
              onSelect={() => setSelected(selected === senator.code ? null : senator.code)}
            />
          ))}
        </div>
      )}
      {payload && visible.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum senador encontrado para esse filtro.</p>
      )}
    </div>
  )
}
