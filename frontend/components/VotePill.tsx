'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ClassifiedVote } from '@/types/vote'

/**
 * O voto de um parlamentar, com o significado na pill e a procedência no tooltip.
 *
 * A cor separa, não julga: `Sim` não é verde e `Não` não é vermelho, porque isso sugeriria
 * que aprovar é bom e rejeitar é ruim — contra o princípio de neutralidade política.
 *
 * O tooltip guarda o código que a fonte publicou e o texto oficial sem edição. Assim a
 * paráfrase curta (que existe só para caber na linha) nunca vira a única versão na tela.
 *
 * Precisa de um `TooltipProvider` acima na árvore.
 */

const VOTE_STYLE: Record<string, string> = {
  yes: 'border-sky-300/70 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
  no: 'border-violet-300/70 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200',
  other_vote: 'border-slate-300/70 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
  present_not_voted: 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  absent: 'border-border bg-muted/60 text-muted-foreground',
}

export function voteStyleKey(vote: ClassifiedVote): string {
  if (vote.category === 'voted') {
    if (vote.choice === 'yes') return 'yes'
    if (vote.choice === 'no') return 'no'
    return 'other_vote'
  }
  if (vote.category === 'present_not_voted') return 'present_not_voted'
  return 'absent'
}

export function VotePill({ vote, sourceName = 'Senado Federal' }: { vote: ClassifiedVote; sourceName?: string }) {
  const pill = (
    <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', VOTE_STYLE[voteStyleKey(vote)])}>
      {vote.label}
    </span>
  )

  // Codigo desconhecido cai aqui: `label` e o proprio codigo cru, entao nao ha o que explicar.
  if (!vote.officialLabel && vote.officialCode === vote.label) return pill

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {pill}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        <span className="font-semibold">{vote.officialCode}</span>
        {vote.officialLabel ? (
          <>
            {' — '}
            {vote.officialLabel}
            <span className="mt-1 block text-muted-foreground">Fonte: {sourceName}</span>
          </>
        ) : (
          <span className="mt-1 block text-muted-foreground">Código publicado por {sourceName}, sem descrição adicional na fonte</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
