'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { VotePill } from '@/components/VotePill'
import { countByParty, PartyFilter } from '@/components/PartyFilter'
import { cn } from '@/lib/utils'
import { formatSessionDate } from '@/lib/senadoFormat'
import { countThemesInTexts, LEGISLATIVE_THEMES, matchesTheme, normalizeForSearch } from '@/lib/legislativeThemes'
import { votacaoService } from '@/services/votacaoService'
import type { MateriaGroup, VotacaoDetail, VotacaoSenatorVote, VotacaoSummary, VotacoesPayload } from '@/types/votacao'

/**
 * As matérias votadas em plenário, e como cada senador votou em cada votação.
 *
 * A lista é por MATÉRIA, não por votação: a mesma proposição volta ao plenário uma vez por
 * dispositivo (artigo, emenda, substitutivo, turno), e a `PEC 6/2019` sozinha tem 11
 * votações. Listadas soltas, viram 11 cards com a ementa idêntica e a tela parece repetida.
 * Agrupadas, a repetição vira informação: a matéria foi fatiada em 11 decisões.
 */

/** Quantas matérias renderizar por vez. */
const PAGE_SIZE = 30

const RESULT_STYLE: Record<string, string> = {
  approved: 'border-sky-300/70 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
  rejected: 'border-violet-300/70 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200',
  unknown: 'border-border bg-muted/60 text-muted-foreground',
}

const CONTESTED_CLASS =
  'rounded-full border border-amber-300/70 bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'

function ResultPill({ result }: { result: VotacaoSummary['result'] }) {
  const label = result === 'approved' ? 'Aprovada' : result === 'rejected' ? 'Rejeitada' : 'Sem resultado'
  return <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[10px] font-semibold', RESULT_STYLE[result ?? 'unknown'])}>{label}</span>
}

function TallyBar({ tally }: { tally: VotacaoSummary['tally'] }) {
  const known = tally.yes + tally.no + tally.abstention + tally.presentNotVoted + tally.absent
  if (known === 0) return null
  const pct = (value: number) => `${(100 * value) / known}%`

  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
      <span className="bg-sky-500/80 dark:bg-sky-400/70" style={{ width: pct(tally.yes) }} />
      <span className="bg-violet-500/80 dark:bg-violet-400/70" style={{ width: pct(tally.no) }} />
      <span className="bg-slate-400/70" style={{ width: pct(tally.abstention) }} />
      <span className="bg-amber-400/80 dark:bg-amber-400/60" style={{ width: pct(tally.presentNotVoted) }} />
      <span className="bg-muted-foreground/25" style={{ width: pct(tally.absent) }} />
    </div>
  )
}

/** Uma linha de votação dentro da matéria: o que distingue esta decisão das irmãs. */
function VotacaoRow({ votacao, selected, onSelect }: { votacao: VotacaoSummary; selected: boolean; onSelect: () => void }) {
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
      <div className="flex flex-wrap items-center gap-1.5">
        {/* O rotulo do que foi votado vem antes do resultado: sem ele, "aprovada" seguida de
            duas "rejeitadas" parece contradicao em vez de rito. */}
        {votacao.kind !== null && (
          <span className="rounded border bg-background px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {votacao.kind === 'base_text' ? 'Texto-base' : 'Destaque'}
          </span>
        )}
        <ResultPill result={votacao.result} />
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatSessionDate(votacao.date)}</span>
        {votacao.contested && <span className={CONTESTED_CLASS}>Decidida no fio</span>}
      </div>
      <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{votacao.description ?? 'Sem descrição do dispositivo.'}</p>
      <TallyBar tally={votacao.tally} />
      <p className="text-[11px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{votacao.tally.yes}</span> sim ·{' '}
        <span className="font-semibold text-foreground">{votacao.tally.no}</span> não · {votacao.tally.abstention} abstenção ·{' '}
        {votacao.tally.presentNotVoted} presente sem votar · {votacao.tally.absent} ausente
      </p>
    </button>
  )
}

/**
 * Explica em uma frase por que a matéria tem uma votação aprovada e outras rejeitadas.
 *
 * Só é escrita quando o dado sustenta: exige uma votação de texto-base identificada. Sem ela
 * a função cala, em vez de inventar um desfecho a partir da última votação.
 */
function riteExplanation(materia: MateriaGroup): string | null {
  // Contado a partir das votacoes, nunca de um campo agregado: a lista sempre existe, e um
  // agregado ausente produziria "votou undefined destaque" em vez de silencio.
  const highlights = materia.votacoes.filter((item) => item.kind === 'highlight')
  if (materia.baseTextResult === null || highlights.length === 0) return null

  const base = `O texto-base foi ${materia.baseTextResult === 'approved' ? 'aprovado' : 'rejeitado'}`
  const total = highlights.length
  const rejected = highlights.filter((item) => item.result === 'rejected').length
  const approved = highlights.filter((item) => item.result === 'approved').length

  if (total === 1) {
    if (rejected === 1) return `${base}. O destaque votado à parte foi rejeitado.`
    if (approved === 1) return `${base}. O destaque votado à parte foi aprovado.`
    return `${base}. Houve 1 destaque votado à parte, sem resultado publicado.`
  }
  if (rejected === total) return `${base}. Os ${total} destaques votados à parte foram rejeitados.`
  if (approved === total) return `${base}. Os ${total} destaques votados à parte foram aprovados.`
  // Caso misto: afirma so o que esta verificado, sem completar o resto por deducao.
  return `${base}. Dos ${total} destaques votados à parte, ${rejected} ${rejected === 1 ? 'foi rejeitado' : 'foram rejeitados'}.`
}

function MateriaCard({ materia, selectedId, onSelect }: { materia: MateriaGroup; selectedId: string | null; onSelect: (id: string) => void }) {
  const explanation = riteExplanation(materia)

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{materia.identification}</span>
          {/* O desfecho do texto-base vem primeiro: e o que aconteceu com a lei. */}
          {materia.baseTextResult !== null && (
            <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[10px] font-semibold', RESULT_STYLE[materia.baseTextResult])}>
              Texto-base {materia.baseTextResult === 'approved' ? 'aprovado' : 'rejeitado'}
            </span>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">{formatSessionDate(materia.lastDate)}</span>
          {materia.contestedCount > 0 && (
            <span className={CONTESTED_CLASS}>
              {materia.contestedCount} decidida{materia.contestedCount > 1 ? 's' : ''} no fio
            </span>
          )}
          {materia.officialUrl && (
            <a
              href={materia.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Matéria oficial <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {/* Ementa aparece uma vez por materia — nao uma vez por votacao. */}
        <p className="mt-1.5 text-[13px] leading-relaxed">{materia.summary ?? 'Sem ementa publicada.'}</p>
      </div>

      {explanation && (
        <p className="rounded-md border border-dashed px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">{explanation}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {materia.votacoes.length === 1 ? '1 votação' : `${materia.votacoes.length} votações, na ordem em que aconteceram`}
        </p>
        {materia.votacoes.map((votacao) => (
          <VotacaoRow key={votacao.id} votacao={votacao} selected={selectedId === votacao.id} onSelect={() => onSelect(votacao.id)} />
        ))}
      </div>
    </article>
  )
}

/** Cabeçalho de bloco. O backend já devolve ordenado por categoria, então basta agrupar. */
function groupVotes(votes: VotacaoSenatorVote[]): Array<{ label: string; rows: VotacaoSenatorVote[] }> {
  const groups: Array<{ label: string; rows: VotacaoSenatorVote[] }> = []
  for (const row of votes) {
    const label = row.vote.category === 'voted' ? row.vote.label : row.vote.category === 'present_not_voted' ? 'Presente, não votou' : 'Não votou'
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  }
  return groups
}

function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<VotacaoDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [party, setParty] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDetail(null)
    setError(null)
    setParty(null)

    votacaoService
      .getVotacao(id)
      .then((data) => {
        if (active) setDetail(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os votos desta pauta.')
      })

    return () => {
      active = false
    }
  }, [id])

  const parties = useMemo(() => countByParty(detail?.votes ?? []), [detail])
  const visible = useMemo(() => (detail ? detail.votes.filter((row) => (party ? row.party === party : true)) : []), [detail, party])
  const groups = useMemo(() => groupVotes(visible), [visible])

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold tracking-[-0.01em]">{detail?.identification ?? 'Carregando…'}</h2>
            {detail && <ResultPill result={detail.result} />}
            {detail?.contested && <span className={CONTESTED_CLASS}>Decidida no fio</span>}
          </div>
          {detail && (
            <>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{detail.summary ?? 'Sem ementa publicada.'}</p>
              {detail.description && <p className="mt-1 text-xs text-muted-foreground">Em votação: {detail.description}</p>}
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {formatSessionDate(detail.date)} · {detail.tally.yes} sim · {detail.tally.no} não · {detail.tally.abstention} abstenção
                {detail.officialUrl && (
                  <>
                    {' · '}
                    <a href={detail.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                      matéria oficial <ExternalLink className="size-3" />
                    </a>
                  </>
                )}
              </p>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar pauta" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </header>

      {error && <p className="p-4 text-sm text-muted-foreground">{error}</p>}
      {!detail && !error && <p className="p-4 text-sm text-muted-foreground">Carregando os votos…</p>}

      {detail && (
        <>
          <div className="border-b px-4 py-3">
            {/* Partido da EPOCA do voto — e ele que explica como a bancada votou naquele dia. */}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Partido na data do voto</p>
            <PartyFilter parties={parties} selected={party} onSelect={setParty} />
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="sticky top-0 z-10 border-b bg-muted/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {group.label} · {group.rows.length}
                </p>
                <ul>
                  {group.rows.map((row) => (
                    <li key={`${row.code ?? row.name}`} className="flex items-center gap-3 border-b px-4 py-2 last:border-b-0">
                      <VotePill vote={row.vote} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{row.name ?? 'Sem nome'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.party ?? 'sem partido'} · {row.state ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {visible.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum senador desse partido nesta votação.</p>}
          </div>
        </>
      )}
    </section>
  )
}

export function PautasPanel() {
  const [payload, setPayload] = useState<VotacoesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<string | null>(null)
  const [onlyContested, setOnlyContested] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    votacaoService
      .getVotacoes()
      .then((data) => {
        if (active) setPayload(data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar as pautas. A API do Senado pode estar fora do ar.')
      })

    return () => {
      active = false
    }
  }, [])

  const themeCounts = useMemo(() => countThemesInTexts((payload?.materias ?? []).map((materia) => `${materia.identification} ${materia.summary ?? ''}`)), [payload])

  const matches = useMemo(() => {
    if (!payload) return []
    const term = normalizeForSearch(query.trim())
    const activeTheme = LEGISLATIVE_THEMES.find((item) => item.id === theme)

    return payload.materias
      .filter((materia) => (onlyContested ? materia.contestedCount > 0 : true))
      .filter((materia) => (activeTheme ? matchesTheme(`${materia.identification} ${materia.summary ?? ''}`, activeTheme) : true))
      .filter((materia) => {
        if (!term) return true
        const haystack = `${materia.identification} ${materia.summary ?? ''} ${materia.votacoes.map((item) => item.description ?? '').join(' ')}`
        return normalizeForSearch(haystack).includes(term)
      })
  }, [payload, query, theme, onlyContested])

  return (
    <div className="flex flex-col gap-4">
      {payload && (
        <p className="text-xs text-muted-foreground">
          {payload.coverage.materiaCount} matérias em {payload.coverage.votacaoCount} votações nominais de {payload.coverage.fromYear} a{' '}
          {payload.coverage.toYear}. A mesma matéria volta ao plenário uma vez por dispositivo votado.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setLimit(PAGE_SIZE)
            }}
            placeholder="Buscar por matéria ou texto da ementa"
            className="pl-9"
            aria-label="Buscar pauta"
          />
        </div>

        {/* Tema e conjunto de radicais, nao busca de frase: a ementa da PEC 6/2019 fala em
            "previdência social" e nunca em "reforma da previdência". */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGISLATIVE_THEMES.map((item) => {
            const count = themeCounts[item.id] ?? 0
            const active = theme === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTheme(active ? null : item.id)
                  setLimit(PAGE_SIZE)
                }}
                aria-pressed={active}
                disabled={count === 0}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                  active ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
                )}
              >
                {item.label} <span className="font-normal opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            onClick={() => {
              setOnlyContested((previous) => !previous)
              setLimit(PAGE_SIZE)
            }}
            aria-pressed={onlyContested}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              onlyContested
                ? 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                : 'bg-card text-muted-foreground hover:bg-muted/60'
            )}
          >
            Só as decididas no fio ({payload?.coverage.contestedCount ?? 0})
          </button>
          {payload && (
            <p className="text-xs text-muted-foreground">
              {matches.length} {matches.length === 1 ? 'matéria encontrada' : 'matérias encontradas'}
            </p>
          )}
        </div>
      </div>

      {onlyContested && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          40% das votações do período foram unânimes e não separam ninguém. Estas foram decididas por menos de 10% de
          diferença — é onde o voto de cada senador de fato pesou.
        </p>
      )}

      {error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{error}</div>}
      {!payload && !error && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Lendo as votações no Senado…</div>}

      {selected !== null && <DetailPanel id={selected} onClose={() => setSelected(null)} />}

      {payload && (
        <div className="grid gap-3 xl:grid-cols-2">
          {matches.slice(0, limit).map((materia) => (
            <MateriaCard key={materia.identification} materia={materia} selectedId={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />
          ))}
        </div>
      )}

      {payload && matches.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((previous) => previous + PAGE_SIZE)}
          className="mx-auto rounded-full border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver mais ({matches.length - limit} restantes)
        </button>
      )}
      {payload && matches.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhuma matéria encontrada para esse filtro.</p>
      )}
    </div>
  )
}
