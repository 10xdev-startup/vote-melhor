'use client'

import { cn } from '@/lib/utils'

/**
 * Filtro por partido, compartilhado pelas telas de senadores e de pautas.
 *
 * A ordem é por contagem e depois alfabética — nunca por ideologia, tamanho de bancada
 * "relevante" ou qualquer critério editorial. Ordenação default que privilegia partido
 * violaria a neutralidade que o projeto exige.
 *
 * Nas pautas, `party` é o partido no MOMENTO do voto, não o atual: o Senado guarda a
 * filiação da época, e é ela que explica como a bancada votou naquele dia.
 */

export interface PartyCount {
  party: string
  count: number
}

interface FilterCount {
  value: string
  count: number
}

function CountFilter({ ariaLabel, items, selected, onSelect, allLabel }: { ariaLabel: string; items: FilterCount[]; selected: string | null; onSelect: (value: string | null) => void; allLabel: string }) {
  if (items.length === 0) return null

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={cn(
          'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected === null ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
        )}
      >
        {allLabel}
      </button>
      {items.map(({ value, count }) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(selected === value ? null : value)}
          aria-pressed={selected === value}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === value ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
          )}
        >
          {value} <span className="font-normal opacity-60">{count}</span>
        </button>
      ))}
    </div>
  )
}

export function PartyFilter({ parties, selected, onSelect }: { parties: PartyCount[]; selected: string | null; onSelect: (party: string | null) => void }) {
  return <CountFilter ariaLabel="Filtrar por partido" items={parties.map(({ party, count }) => ({ value: party, count }))} selected={selected} onSelect={onSelect} allLabel="Todos" />
}

export interface StateCount {
  state: string
  count: number
}

export function StateFilter({ states, selected, onSelect }: { states: StateCount[]; selected: string | null; onSelect: (state: string | null) => void }) {
  return <CountFilter ariaLabel="Filtrar deputados por estado" items={states.map(({ state, count }) => ({ value: state, count }))} selected={selected} onSelect={onSelect} allLabel="Todos os estados" />
}

/** Conta parlamentares por partido e ordena por contagem, desempatando alfabeticamente. */
export function countByParty(items: Array<{ party: string | null }>): PartyCount[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.party) continue
    counts.set(item.party, (counts.get(item.party) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([party, count]) => ({ party, count }))
    .sort((a, b) => (b.count - a.count) || a.party.localeCompare(b.party, 'pt-BR'))
}

/** Conta parlamentares por UF e mantém a ordem alfabética dos estados. */
export function countByState(items: Array<{ state: string | null }>): StateCount[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.state) continue
    counts.set(item.state, (counts.get(item.state) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => a.state.localeCompare(b.state, 'pt-BR'))
}
