'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

/** Sentinela do "Todos" — o Radix Select não aceita item com value vazio. */
const ALL_VALUE = '__all__'

function CountFilter({ ariaLabel, items, selected, onSelect, allLabel }: { ariaLabel: string; items: FilterCount[]; selected: string | null; onSelect: (value: string | null) => void; allLabel: string }) {
  if (items.length === 0) return null

  return (
    <Select value={selected ?? ALL_VALUE} onValueChange={(value) => onSelect(value === ALL_VALUE ? null : value)}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {items.map(({ value, count }) => (
          <SelectItem key={value} value={value}>
            {value} <span className="font-normal opacity-60">{count}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
