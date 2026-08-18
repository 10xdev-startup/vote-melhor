import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CamaraView } from './CamaraView'

export const metadata: Metadata = {
  title: 'Câmara dos Deputados',
  description: 'Deputados em exercício e seus votos nominais publicados no Plenário em 2026, com fontes oficiais.',
}

export default function CamaraPage() {
  return (
    <div className="p-2">
      <Suspense fallback={null}>
        <CamaraView />
      </Suspense>
    </div>
  )
}
