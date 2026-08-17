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

export function PartyFilter({ parties, selected, onSelect }: { parties: PartyCount[]; selected: string | null; onSelect: (party: string | null) => void }) {
  if (parties.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={cn(
          'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected === null ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
        )}
      >
        Todos
      </button>
      {parties.map(({ party, count }) => (
        <button
          key={party}
          type="button"
          onClick={() => onSelect(selected === party ? null : party)}
          aria-pressed={selected === party}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === party ? 'border-foreground/20 bg-foreground/5 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
          )}
        >
          {party} <span className="font-normal opacity-60">{count}</span>
        </button>
      ))}
    </div>
  )
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
