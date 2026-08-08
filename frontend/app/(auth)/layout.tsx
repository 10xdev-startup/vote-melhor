import { FileText, Link2, Vote } from 'lucide-react'

// Moldura das telas de entrada (/login e /cadastro). O grupo (auth) some da URL e
// existe justamente por este layout: a coluna de branding e identica nas duas telas.
// A tela de boas-vindas NAO entra aqui — ela ocupa a largura toda.

const DESTAQUES = [
  { icon: Vote, text: 'Votações, proposições e gastos direto das fontes oficiais' },
  { icon: FileText, text: 'IA que traduz o juridiquês — explica, não opina' },
  { icon: Link2, text: 'Toda informação com link para o documento que a sustenta' },
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-col items-center justify-center bg-sidebar p-12 text-sidebar-foreground lg:flex lg:w-[42%]">
        <div className="max-w-md space-y-8">
          <h1 className="text-center text-4xl font-bold">
            10x<span className="text-sidebar-primary">Gov</span>
          </h1>
          <p className="text-center text-lg leading-relaxed text-sidebar-foreground/80">
            Os dados do governo brasileiro já são públicos. Aqui eles ficam
            compreensíveis — unificados, relacionados e explicados em linguagem simples.
          </p>
          <div className="mt-8 space-y-4">
            {DESTAQUES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-base">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
