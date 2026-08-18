import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FonteDeDadosView } from './FonteDeDadosView'

export const metadata: Metadata = {
  title: 'Fonte de dados',
  description: 'Catálogo navegável dos arquivos publicados pelos órgãos oficiais.',
}

export default function FonteDeDadosPage() {
  return (
    <div className="p-2">
      <Suspense fallback={null}>
        <FonteDeDadosView />
      </Suspense>
    </div>
  )
}
