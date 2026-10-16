import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LicitacoesView } from './LicitacoesView'

export const metadata: Metadata = {
  title: 'Licitações',
  description: 'Pregões eletrônicos federais com proposta aberta e o caminho para vender ao governo.',
}

export default function LicitacoesPage() {
  return (
    <Suspense fallback={null}>
      <LicitacoesView />
    </Suspense>
  )
}
