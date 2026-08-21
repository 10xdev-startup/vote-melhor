import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Database, Landmark, Vote } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Início',
  description: 'Ponto de entrada da Vote Melhor: acesso à Câmara, ao Senado e ao catálogo de fontes oficiais.',
}

const DESTINATIONS = [
  {
    href: '/camara',
    icon: Landmark,
    title: 'Câmara dos Deputados',
    description: 'Deputados em exercício e seus votos nominais publicados no Plenário, com fontes oficiais.',
  },
  {
    href: '/senado',
    icon: Vote,
    title: 'Senado Federal',
    description: 'Como cada senador votou e o que o plenário votou, com link para a matéria oficial.',
  },
  {
    href: '/fonte-de-dados',
    icon: Database,
    title: 'Fonte de dados',
    description: 'Catálogo navegável dos arquivos publicados pelos órgãos oficiais.',
  },
]

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-6 p-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Vote Melhor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dados públicos do Congresso Nacional, direto da fonte oficial. Escolha por onde começar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DESTINATIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-sky-200 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-sky-900 dark:hover:bg-sky-950/20"
          >
            <span className="grid size-10 place-items-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
              <item.icon className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold tracking-[-0.01em]">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-sky-700 dark:text-sky-300">
              Acessar <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
