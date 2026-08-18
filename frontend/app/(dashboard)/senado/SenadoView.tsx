'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { SenadoresPanel } from './SenadoresPanel'
import { PautasPanel } from './PautasPanel'

/**
 * As duas leituras do mesmo conjunto de votacoes nominais: por pessoa e por pauta.
 *
 * A aba vive na URL (`?tab=senadores|pautas`) porque o link e o mecanismo de propagacao do
 * produto — "olha como o senador X votou" precisa abrir onde quem mandou estava. Sem isso o
 * compartilhamento sempre cai na aba default. Mesmo padrao da tela de Fonte de dados.
 *
 * O `TooltipProvider` fica aqui, uma vez, servindo os dois paineis.
 */

type Tab = 'senadores' | 'pautas'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'senadores', label: 'Senadores' },
  { id: 'pautas', label: 'Pautas' },
]

function readTab(value: string | null): Tab {
  return value === 'pautas' ? 'pautas' : 'senadores'
}

export function SenadoView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlTab = readTab(searchParams.get('tab'))
  const [activeTab, setActiveTab] = useState<Tab>(urlTab)

  // Voltar/avancar do browser tem que trocar a aba; o `searchParams` sozinho nao cobre.
  useEffect(() => {
    const syncFromHistory = () => {
      setActiveTab(readTab(new URLSearchParams(window.location.search).get('tab')))
    }
    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  // Primeira visita chega sem `?tab=`: grava o default para o link ficar completo ao copiar.
  useEffect(() => {
    const current = searchParams.get('tab')
    if (current === 'senadores' || current === 'pautas') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', urlTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, urlTab])

  const selectTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab)
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.02em]">Senado Federal</h1>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            O que foi votado em plenário e como cada senador votou. Em votação secreta o Senado não publica o voto
            individual, então elas ficam de fora.
          </p>
        </header>

        <div role="tablist" aria-label="Visões das votações do Senado" className="flex w-fit rounded-lg border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
                activeTab === tab.id && 'bg-background text-foreground shadow-sm'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
          {activeTab === 'senadores' ? <SenadoresPanel /> : <PautasPanel />}
        </div>
      </div>
    </TooltipProvider>
  )
}
