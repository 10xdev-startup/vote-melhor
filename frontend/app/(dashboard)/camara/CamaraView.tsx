'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { DeputadosPanel } from './DeputadosPanel'
import { PautasPanel } from './PautasPanel'

type Tab = 'deputados' | 'pautas'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'deputados', label: 'Deputados' },
  { id: 'pautas', label: 'Pautas' },
]

function readTab(value: string | null): Tab {
  return value === 'pautas' ? 'pautas' : 'deputados'
}

export function CamaraView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlTab = readTab(searchParams.get('tab'))
  const [activeTab, setActiveTab] = useState<Tab>(urlTab)

  useEffect(() => {
    const syncFromHistory = () => setActiveTab(readTab(new URLSearchParams(window.location.search).get('tab')))
    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  useEffect(() => {
    const current = searchParams.get('tab')
    if (current === 'deputados' || current === 'pautas') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', urlTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, urlTab])

  const selectTab = useCallback((tab: Tab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.02em]">Câmara dos Deputados</h1>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Quem são os 513 deputados em exercício, o que o Plenário votou e quais escolhas individuais a Câmara publicou em 2026. A fonte não lista ausentes, então a 10xGov não calcula taxa de participação.
          </p>
        </header>

        <div role="tablist" aria-label="Visões das votações da Câmara" className="flex w-fit rounded-lg border bg-muted/40 p-1">
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
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
          {activeTab === 'deputados' ? <DeputadosPanel /> : <PautasPanel />}
        </div>
      </div>
    </TooltipProvider>
  )
}
