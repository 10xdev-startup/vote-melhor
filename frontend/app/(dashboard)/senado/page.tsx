import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SenadoView } from './SenadoView'

export const metadata: Metadata = {
  title: 'Senado',
  description: 'Como cada senador votou e o que o plenário votou, com link para a matéria oficial.',
}

export default function SenadoPage() {
  return (
    <div className="p-2">
      <Suspense fallback={null}>
        <SenadoView />
      </Suspense>
    </div>
  )
}
