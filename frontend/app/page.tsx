import { Instrument_Serif } from 'next/font/google'
import { ArrowDown, ArrowRight, Building2, Database, FileText, Landmark, Link2, Scale, Search, Sparkles, Vote } from 'lucide-react'

const instrumentSerif = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', variable: '--font-instrument-serif' })

const PERGUNTAS = [
  'Como meu deputado votou nos últimos anos?',
  'Quem votou a favor desta lei?',
  'Quais parlamentares costumam votar juntos?',
  'O que esta PEC realmente faz?',
  'Quanto determinado parlamentar gastou?',
  'Como um projeto caminhou até ser aprovado?',
]

const FLUXO = [
  { number: '01', eyebrow: 'Coletar', title: 'Direto da fonte oficial.', description: 'Câmara dos Deputados e Senado Federal hoje. TSE, Portal da Transparência e Diário Oficial na sequência, cada órgão como um módulo isolado.' },
  { number: '02', eyebrow: 'Normalizar', title: 'Órgãos diferentes, um contrato só.', description: 'Formatos, identificadores e vocabulários divergentes viram um modelo único — sem perder de onde cada campo veio.' },
  { number: '03', eyebrow: 'Explicar', title: 'A IA traduz. Ela não opina.', description: 'Resumo, tradução de juridiquês, linha do tempo e similaridade de votos. Juízo de valor político não entra.' },
  { number: '04', eyebrow: 'Citar', title: 'Toda resposta leva à origem.', description: 'Cada informação carrega o link do documento oficial que a sustenta. Sem fonte verificável, não é resposta.' },
]

const COBERTURA = [
  { icon: Vote, label: 'Votações', title: 'Como cada um votou', description: 'Histórico de votações nominais, por parlamentar e por proposição, com o resultado de cada sessão.' },
  { icon: FileText, label: 'Proposições', title: 'PLs, PECs e MPs', description: 'Texto, tramitação e o caminho percorrido até virar lei — ou até parar no meio.' },
  { icon: Building2, label: 'Comissões', title: 'Onde a lei se decide', description: 'Composição, relatorias e as decisões que acontecem antes do plenário.' },
  { icon: Scale, label: 'Transparência', title: 'Gastos e emendas', description: 'Despesas parlamentares, emendas e presença em sessões, ligadas a quem as originou.' },
]

const PRINCIPIOS = [
  'Dados oficiais como única fonte de verdade',
  'Transparência total sobre a origem das informações',
  'Neutralidade política',
  'Explicações em linguagem simples',
  'Código aberto e APIs abertas',
  'IA como ferramenta de compreensão, não de opinião',
]

export default function HomePage(): React.JSX.Element {
  return (
    <div className={`${instrumentSerif.variable} min-h-screen overflow-hidden bg-[#f2efe7] text-[#111725] selection:bg-[#315bff] selection:text-white`}>
      <section className="relative mx-auto max-w-[1180px] px-6 pb-14 pt-14 md:px-10 md:pb-20 md:pt-20">
        <div className="pointer-events-none absolute -right-24 top-0 size-[430px] rounded-full bg-[#315bff]/10 blur-[100px]" aria-hidden />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="lp-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#111725]/12 bg-white/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/65">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#315bff] opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-[#315bff]" />
              </span>
              Dados públicos do governo brasileiro
            </div>

            <h1 className="lp-display mt-8 max-w-[760px] text-[2.8rem] leading-[0.99] tracking-[-0.04em] sm:text-[3.4rem] lg:text-[4rem]">
              Os dados já são públicos. A 10xGov os torna <span className="text-[#315bff]">compreensíveis.</span>
            </h1>

            <p className="mt-8 max-w-[560px] text-[17px] leading-7 text-[#111725]/64 md:text-lg">
              Votações, projetos de lei, discursos, gastos e emendas existem — espalhados por
              órgãos diferentes, em formatos complexos, exigindo conhecimento técnico. Unificamos
              as fontes oficiais e usamos IA para explicá-las em linguagem simples.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
              <div className="flex items-center gap-2">
                <Landmark className="size-[18px] text-[#315bff]" strokeWidth={1.8} aria-hidden />
                <span className="text-[13px] font-semibold">Câmara dos Deputados</span>
              </div>
              <div className="flex items-center gap-2">
                <Landmark className="size-[18px] text-[#315bff]" strokeWidth={1.8} aria-hidden />
                <span className="text-[13px] font-semibold">Senado Federal</span>
              </div>
            </div>
          </div>

          <div className="lp-rise lp-delay-1 relative">
            <div className="absolute -left-4 -top-5 z-10 hidden rotate-[-4deg] rounded-sm bg-[#d9ff70] px-4 py-2 text-xs font-semibold shadow-sm md:block">
              Da fonte oficial até a resposta
            </div>

            <div className="lp-grid overflow-hidden rounded-[24px] border border-white/10 bg-[#111725] p-5 text-white shadow-[0_28px_80px_rgba(17,23,37,0.22)] sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#d9ff70]" />
                  <span className="text-xs font-semibold tracking-wide">PIPELINE · FONTE OFICIAL</span>
                </div>
                <span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/55">
                  Procedência
                </span>
              </div>

              <div className="grid gap-3 py-5 sm:grid-cols-[0.9fr_auto_1fr] sm:items-center">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-white/10"><Landmark className="size-4 text-[#9eb0ff]" strokeWidth={1.8} /></span>
                    <div>
                      <p className="text-xs font-semibold">Câmara</p>
                      <p className="mt-0.5 text-[10px] text-white/45">API oficial</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-white/10"><Landmark className="size-4 text-[#9eb0ff]" strokeWidth={1.8} /></span>
                    <div>
                      <p className="text-xs font-semibold">Senado</p>
                      <p className="mt-0.5 text-[10px] text-white/45">API oficial</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[0.03] p-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06]"><Database className="size-4 text-white/40" strokeWidth={1.8} /></span>
                    <div>
                      <p className="text-xs font-semibold text-white/70">TSE, DOU, Transparência</p>
                      <p className="mt-0.5 text-[10px] text-white/40">Próximas fontes</p>
                    </div>
                  </div>
                </div>

                <ArrowRight className="hidden size-4 text-white/25 sm:block" aria-hidden />
                <ArrowDown className="mx-auto size-4 text-white/25 sm:hidden" aria-hidden />

                <div className="space-y-2">
                  <div className="rounded-xl border border-[#6f8cff]/40 bg-[#315bff]/15 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9eb0ff]">Normalização</p>
                    <p className="mt-1 text-xs text-white/70">Contrato único entre órgãos</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Índice semântico</p>
                    <p className="mt-1 text-xs text-white/70">Busca por sentido, não por palavra</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl border border-[#d9ff70]/25 bg-[#d9ff70]/10 p-3">
                    <Link2 className="mt-0.5 size-3.5 shrink-0 text-[#d9ff70]" strokeWidth={2} aria-hidden />
                    <p className="text-xs leading-relaxed text-white/80">Resposta com link do documento oficial</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#111725]/10 bg-white/40">
        <div className="mx-auto max-w-[1180px] px-6 py-14 md:px-10 md:py-16">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">
            <Search className="size-3.5" strokeWidth={2} aria-hidden />
            O problema
          </div>
          <h2 className="lp-display mt-4 max-w-[680px] text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]">
            Responder qualquer uma destas exige atravessar vários portais.
          </h2>

          <ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERGUNTAS.map((pergunta) => (
              <li key={pergunta} className="rounded-2xl border border-[#111725]/10 bg-white/70 px-5 py-4 text-[15px] leading-relaxed text-[#111725]/75">
                {pergunta}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-[#111725]/10">
        <div className="mx-auto max-w-[1180px] px-6 py-14 md:px-10 md:py-16">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">
            <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />
            Como funciona
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {FLUXO.map((passo) => (
              <div key={passo.number} className="border-t border-[#111725]/12 pt-5">
                <div className="flex items-baseline gap-3">
                  <span className="lp-display text-[1.6rem] leading-none text-[#315bff]">{passo.number}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">{passo.eyebrow}</span>
                </div>
                <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">{passo.title}</h3>
                <p className="mt-2 max-w-[440px] text-[15px] leading-7 text-[#111725]/62">{passo.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#111725]/10 bg-white/40">
        <div className="mx-auto max-w-[1180px] px-6 py-14 md:px-10 md:py-16">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">O que já está no escopo</div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {COBERTURA.map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[#111725]/10 bg-white/70 p-6">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#315bff]/10 text-[#315bff]">
                    <item.icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">{item.label}</span>
                </div>
                <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[#111725]/62">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#111725]/10">
        <div className="mx-auto max-w-[1180px] px-6 py-14 md:px-10 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111725]/45">Princípios</div>
              <h2 className="lp-display mt-4 text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem]">
                Restrições de projeto, não slogans.
              </h2>
              <p className="mt-5 max-w-[420px] text-[15px] leading-7 text-[#111725]/62">
                Cada princípio vira uma decisão técnica verificável — do dado que carrega procedência
                à ordenação que nunca privilegia um parlamentar.
              </p>
            </div>

            <ul className="grid gap-2.5 sm:grid-cols-2">
              {PRINCIPIOS.map((principio) => (
                <li key={principio} className="flex items-start gap-3 rounded-2xl border border-[#111725]/10 bg-white/60 px-5 py-4">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#315bff]" aria-hidden />
                  <span className="text-[15px] leading-6 text-[#111725]/75">{principio}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-[#111725]/10 bg-[#111725] text-white">
        <div className="lp-grid mx-auto max-w-[1180px] px-6 py-14 md:px-10 md:py-16">
          <h2 className="lp-display max-w-[720px] text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.6rem]">
            Infraestrutura aberta para dados governamentais brasileiros.
          </h2>
          <p className="mt-6 max-w-[600px] text-[16px] leading-7 text-white/60">
            Assim como o GitHub democratizou o acesso ao código e o Stripe simplificou pagamentos,
            a 10xGov quer simplificar o acesso aos dados públicos brasileiros. Todo dado exposto na
            interface fica acessível também via API.
          </p>
        </div>
      </section>
    </div>
  )
}
