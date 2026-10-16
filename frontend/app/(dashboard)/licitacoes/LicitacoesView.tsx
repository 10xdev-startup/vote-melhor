'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, Bookmark } from 'lucide-react'
const DossierPdfPreview = dynamic(() => import('@/components/dossiers/DossierPdfPreview').then((mod) => mod.DossierPdfPreview), { ssr: false })
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROCUREMENT_SOURCES, PROCUREMENT_TRAIL } from '@/data/procurementTrail'
import { ApiRequestError } from '@/services/apiErrors'
import { getApiBaseUrl } from '@/lib/apiBase'
import { procurementService, type OpenBidsPage } from '@/services/procurementService'
import { cn } from '@/lib/utils'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const SAVED_KEY = 'licitacoes-salvas'

function disputePlace(raw: string): string {
  try {
    const host = new URL(raw).hostname.replace(/^www\d*\./, '')
    if (host.endsWith('portaldecompraspublicas.com.br')) return 'Portal de Compras Públicas'
    if (host.endsWith('licitanet.com.br')) return 'Licitanet'
    if (host.endsWith('licitardigital.com.br')) return 'Licitar Digital'
    if (host.endsWith('ammlicita.org.br')) return 'AMM Licita'
    if (host.endsWith('bllcompras.com')) return 'BLL Compras'
    if (host.endsWith('bnccompras.com')) return 'BNC Compras'
    if (host.endsWith('compras.mg.gov.br')) return 'Compras MG'
    if (host.includes('comprasnet') || host.endsWith('serpro.gov.br')) return 'Compras.gov.br'
    if (host.endsWith('pncp.gov.br')) return 'PNCP'
    const name = host.split('.')[0] ?? host
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return 'Disputa'
  }
}

function formatCnpj(digits: string): string {
  return [digits.slice(0, 2), digits.length > 2 ? `.${digits.slice(2, 5)}` : '', digits.length > 5 ? `.${digits.slice(5, 8)}` : '', digits.length > 8 ? `/${digits.slice(8, 12)}` : '', digits.length > 12 ? `-${digits.slice(12, 14)}` : ''].join('')
}

function companyChecks(digits: string): { label: string; href: string }[] {
  const cnpj = digits.length === 14 ? digits : ''
  const inidoneos = cnpj ? `https://certidoes.apps.tcu.gov.br/lista-inidoneos?cnpj=${cnpj}` : 'https://certidoes.apps.tcu.gov.br/lista-inidoneos'
  const sanctions = cnpj ? `&cpfCnpj=${cnpj}` : ''
  return [
    { label: 'Consulta consolidada do TCU', href: inidoneos },
    { label: 'Empresas inidôneas', href: inidoneos },
    { label: 'Sanções', href: `https://portaldatransparencia.gov.br/sancoes/consulta?ordenarPor=nomeSancionado&direcao=asc${sanctions}` },
  ]
}

function CompanyStanding() {
  const [digits, setDigits] = useState('')
  return (
    <form className="flex flex-nowrap items-center gap-2 rounded-lg border bg-card px-3 py-2" onSubmit={(event) => event.preventDefault()}>
      <Input value={formatCnpj(digits)} onChange={(event) => setDigits(event.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" aria-label="CNPJ da empresa" placeholder="CNPJ" className="h-8 w-44 shrink-0" />
      {companyChecks(digits).map((check) => <a key={check.label} href={check.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">{check.label}<ArrowUpRight className="size-3.5" /></a>)}
    </form>
  )
}

function when(iso: string): string {
  const [date, time] = iso.split('T')
  if (!date) return 'prazo no edital'
  const [year, month, day] = date.split('-')
  const hour = time?.slice(0, 5)
  return hour ? `${day}/${month}/${year} às ${hour}` : `${day}/${month}/${year}`
}

function ProcessTab() {
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Como o mercado funciona">
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Quem compra</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Órgãos da União, dos estados e dos municípios seguem a Lei 14.133/2021. Empresas públicas e sociedades de economia mista seguem a Lei 13.303/2016.</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Onde achar</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">O PNCP reúne os avisos. A proposta entra no sistema do edital: no federal, o Compras.gov.br; em Minas, o Portal de Compras MG.</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Como se ganha</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">O melhor lance ainda passa pelo julgamento e pela habilitação. Só então há contrato. Vencer a disputa não autoriza começar o serviço.</p>
        </article>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">{PROCUREMENT_TRAIL.research?.scope} Revisão documental em {PROCUREMENT_TRAIL.research?.reviewedAt.split('-').reverse().join('/')}.</p>
      <section aria-labelledby="roteiro-title">
        <h2 id="roteiro-title" className="text-lg font-semibold">O caminho de quem quer vender</h2>
        <ol className="mt-4 divide-y overflow-hidden rounded-xl border bg-card">
          {PROCUREMENT_TRAIL.steps.map((step, index) => {
            const sources = step.sourceIds.map((id) => PROCUREMENT_SOURCES[id]).filter((source) => source !== undefined)
            return (
              <li key={step.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-xs font-semibold tabular-nums text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-foreground/80">{step.question}</p>
                    {step.guidance && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.guidance.outcome}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sources.map((source) => (
                        <a key={source.id} href={source.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                          {source.title}
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const ALL = '__all__'
const ESFERA_LABEL: Record<string, string> = { '': 'Todas as esferas', F: 'Federal', E: 'Estadual', M: 'Municipal', D: 'Distrital' }
const MODALIDADE_LABEL: Record<string, string> = { '': 'Todas as modalidades', '6': 'Pregão eletrônico', '4': 'Concorrência eletrônica', '1': 'Convite', '8': 'Dispensa' }
const ASSUNTO_LABEL: Record<string, string> = { '': 'Todos os assuntos', ti: 'Tecnologia', saude: 'Saúde', educacao: 'Educação', obras: 'Obras', alimentacao: 'Alimentação', transporte: 'Transporte', seguranca: 'Segurança' }
const RECORTE_LABEL: Record<string, string> = { saas: 'SaaS' }

function selectedFilters(cidade: string, uf: string, esfera: string, modalidade: string, assunto: string, recorte: string): string[] {
  return [
    cidade,
    uf || 'Todas as UFs',
    ESFERA_LABEL[esfera] ?? esfera,
    MODALIDADE_LABEL[modalidade] ?? modalidade,
    ASSUNTO_LABEL[assunto] ?? assunto,
    RECORTE_LABEL[recorte] ?? '',
  ].filter(Boolean)
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
        <SelectTrigger aria-label={label} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.label} value={option.value || ALL}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function collectedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'data não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)
}

function statusLine(page: OpenBidsPage, uf: string, modalidade: string): string {
  const shown = page.total > page.bids.length ? `${page.bids.length} de ${page.total.toLocaleString('pt-BR')}` : page.total.toLocaleString('pt-BR')
  const parts = [`Página ${page.page} · ${shown} · coletado em ${collectedLabel(page.collectedAt)}`]
  if (page.stopped === 'rate-limit') parts.push('A coleta parou porque o PNCP pediu para esperar.')
  if (page.stopped === 'page-limit') parts.push('A coleta parou no limite de páginas.')
  if (uf && page.ufs.length && !page.ufs.includes(uf)) parts.push(`${uf} ainda não entrou na coleta.`)
  if (modalidade && page.coverageModalidade && modalidade !== page.coverageModalidade) parts.push('Esta coleta não tem essa modalidade.')
  return parts.join(' ')
}

function AnexoDialog({ anexo, onClose }: { anexo: { label: string; name?: string; url?: string; arquivo?: string } | null; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!anexo) return
    let active = true
    setBlob(null)
    setError(false)
    const address = anexo.url ? `${getApiBaseUrl()}/licitacoes/documento?url=${encodeURIComponent(anexo.url)}${anexo.arquivo ? `&arquivo=${encodeURIComponent(anexo.arquivo)}` : ''}` : `${getApiBaseUrl()}/licitacoes/anexos/${anexo.name}`
    fetch(address)
      .then((response) => { if (!response.ok) throw new Error('anexo'); return response.blob() })
      .then((file) => { if (active) setBlob(file) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [anexo])

  return (
    <Dialog open={anexo !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="grid h-[min(92vh,960px)] w-[min(960px,calc(100%-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>{anexo?.label}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">Não foi possível abrir o PDF.</p>}
        {!error && !blob && <p className="text-sm text-muted-foreground">Abrindo o PDF…</p>}
        {blob && <DossierPdfPreview blob={blob} />}
      </DialogContent>
    </Dialog>
  )
}

function PageHeading({ tab, onSelect, city }: { tab: 'abertas' | 'processo'; onSelect: (next: 'abertas' | 'processo') => void; city?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">Licitações</h1>
      {city}
      <div role="tablist" aria-label="Licitações" className="ml-auto flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
        {([['abertas', 'Em aberto'], ['processo', 'Como funciona']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onSelect(id)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground', tab === id && 'bg-background text-foreground shadow-sm')}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function OpenBids({ tab, onSelect }: { tab: 'abertas' | 'processo'; onSelect: (next: 'abertas' | 'processo') => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const uf = params.get('uf') ?? ''
  const cidadeQuery = params.get('cidade') ?? ''
  const esfera = params.get('esfera') ?? 'F'
  const modalidade = params.get('modalidade') ?? '6'
  const assunto = params.get('assunto') ?? ''
  const recorte = params.get('recorte') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') || '1') || 1)
  const [cidade, setCidade] = useState(cidadeQuery)
  const [page, setPage] = useState<OpenBidsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [anexo, setAnexo] = useState<{ label: string; name?: string; url?: string; arquivo?: string } | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY)
      if (raw) setSaved(new Set(JSON.parse(raw) as string[]))
    } catch { /* o navegador pode bloquear o armazenamento */ }
  }, [])
  const toggleSave = (id: string) => {
    setSaved((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]))
      return next
    })
  }
  const apply = (next: { uf?: string; cidade?: string; esfera?: string; modalidade?: string; assunto?: string; recorte?: string; pagina?: number }) => {
    const query = new URLSearchParams(params.toString())
    query.set('tab', 'abertas')
    query.set('uf', next.uf ?? uf)
    query.set('cidade', next.cidade ?? cidadeQuery)
    query.set('esfera', next.esfera ?? esfera)
    query.set('modalidade', next.modalidade ?? modalidade)
    query.set('assunto', next.assunto ?? assunto)
    const nextRecorte = next.recorte ?? recorte
    if ((next.assunto ?? assunto) === 'ti' && nextRecorte) query.set('recorte', nextRecorte)
    else query.delete('recorte')
    const nextPage = next.pagina ?? 1
    if (nextPage > 1) query.set('pagina', String(nextPage))
    else query.delete('pagina')
    query.delete('q')
    router.push(`${pathname}?${query.toString()}`, { scroll: false })
  }

  useEffect(() => { setCidade(cidadeQuery) }, [cidadeQuery])

  useEffect(() => {
    const trimmed = cidade.trim()
    if (trimmed === cidadeQuery) return
    const timer = window.setTimeout(() => apply({ cidade: trimmed }), 250)
    return () => window.clearTimeout(timer)
  }, [cidade, cidadeQuery])

  useEffect(() => {
    let active = true
    setPage(null)
    setError(null)
    procurementService.openFederal({ uf, cidade: cidadeQuery, esfera, modalidade, assunto, recorte, pagina })
      .then((result) => { if (active) setPage(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof ApiRequestError ? reason.message : 'Não foi possível ler a lista guardada.') })
    return () => { active = false }
  }, [uf, cidadeQuery, esfera, modalidade, assunto, recorte, pagina])

  const pager = (position: 'topo' | 'fim') => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-muted-foreground">{page ? statusLine(page, uf, modalidade) : error ? '' : 'Lendo a lista guardada…'}</p>
      <div className="flex gap-2">
        <button type="button" disabled={pagina <= 1} onClick={() => apply({ pagina: pagina - 1 })} className="rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-40">Anterior</button>
        <button type="button" disabled={!page || pagina * page.pageSize >= page.total} onClick={() => apply({ pagina: pagina + 1 })} aria-label={position === 'fim' ? 'Próxima página, no fim da lista' : 'Próxima página'} className="rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-40">Próxima</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <PageHeading tab={tab} onSelect={onSelect} city={<Input value={cidade} onChange={(event) => setCidade(event.target.value)} aria-label="Cidade" placeholder="Cidade" className="h-9 w-full max-w-xs" />} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FilterSelect label="UF" value={uf} onChange={(value) => apply({ uf: value })} options={[{ value: '', label: 'Todas' }, ...UFS.map((code) => ({ value: code, label: code }))]} />
        <FilterSelect label="Esfera" value={esfera} onChange={(value) => apply({ esfera: value })} options={[{ value: '', label: 'Todas' }, { value: 'F', label: 'Federal' }, { value: 'E', label: 'Estadual' }, { value: 'M', label: 'Municipal' }]} />
        <FilterSelect label="Modalidade" value={modalidade} onChange={(value) => apply({ modalidade: value })} options={[{ value: '6', label: 'Pregão eletrônico' }, { value: '4', label: 'Concorrência eletrônica' }, { value: '', label: 'Todas' }]} />
        <FilterSelect label="Assunto" value={assunto} onChange={(value) => apply({ assunto: value, recorte: value === 'ti' ? recorte : '' })} options={[{ value: '', label: 'Todos' }, { value: 'ti', label: 'Tecnologia' }, { value: 'saude', label: 'Saúde' }, { value: 'educacao', label: 'Educação' }, { value: 'obras', label: 'Obras' }, { value: 'alimentacao', label: 'Alimentação' }, { value: 'transporte', label: 'Transporte' }, { value: 'seguranca', label: 'Segurança' }]} />
        {assunto === 'ti' && <FilterSelect label="Recorte" value={recorte} onChange={(value) => apply({ recorte: value })} options={[{ value: '', label: 'Todo o tema' }, { value: 'saas', label: 'SaaS' }]} />}
      </div>
      <CompanyStanding />
      <p className="flex flex-wrap gap-1.5" aria-label="Filtros selecionados">
        {selectedFilters(cidadeQuery, uf, esfera, modalidade, assunto, recorte).map((filter, index) => (
          <span key={`${index}-${filter}`} className="rounded-full border bg-card px-2.5 py-0.5 text-xs">{filter}</span>
        ))}
      </p>
      {pager('topo')}
      {error && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</p>}
      {!error && page && !page.bids.length && <p className="text-sm text-muted-foreground">Nenhuma contratação desta coleta passa nesses filtros.</p>}
      {page && page.bids.length > 0 && <ul className="flex flex-col gap-3">
      {page.bids.map((bid) => (
        <li key={bid.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5 font-medium text-foreground">{bid.modalidade}</span>
              <span>{bid.cidade}{bid.uf ? `/${bid.uf}` : ''}</span>
              <span>Propostas até {when(bid.encerramento)}</span>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <a href={bid.pncpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Edital no PNCP<ArrowUpRight className="size-3.5" /></a>
              {bid.disputaUrl && <a href={bid.disputaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">{disputePlace(bid.disputaUrl)}<ArrowUpRight className="size-3.5" /></a>}
            </div>
          </div>
          <h2 className="mt-2 text-sm font-normal leading-snug">{bid.objeto}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{bid.orgao}{bid.unidade ? ` · ${bid.unidade}` : ''}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col items-start gap-1">
              <p className="text-sm font-semibold tabular-nums">{bid.valorEstimado === null ? 'Valor no edital' : money.format(bid.valorEstimado)}</p>
              <button type="button" aria-label={saved.has(bid.id) ? 'Remover dos salvos' : 'Salvar'} aria-pressed={saved.has(bid.id)} onClick={() => toggleSave(bid.id)} className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground', saved.has(bid.id) && 'text-sky-700 dark:text-sky-300')}>
                <Bookmark className={cn('size-4', saved.has(bid.id) && 'fill-current')} />
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {bid.anexos?.map((file) => <button key={file.name} type="button" onClick={() => setAnexo(file)} className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">{file.label}</button>)}
              {bid.documentos?.map((file) => <button key={`${file.url}:${file.arquivo ?? ''}`} type="button" onClick={() => setAnexo({ label: file.label, url: file.url, ...(file.arquivo ? { arquivo: file.arquivo } : {}) })} className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">{file.label}</button>)}
            </div>
            {bid.documentosEm && !bid.documentos?.length && <p className="mt-2 w-full text-right text-[11px] text-muted-foreground">{bid.documentosNota || 'Nenhum PDF publicado.'}</p>}
          </div>
        </li>
      ))}
    </ul>}
      {page && page.bids.length > 0 && pager('fim')}
    <AnexoDialog anexo={anexo} onClose={() => setAnexo(null)} />
    </div>
  )
}

export function LicitacoesView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = params.get('tab') === 'processo' ? 'processo' : 'abertas'

  const select = (next: 'abertas' | 'processo') => {
    const query = new URLSearchParams(params.toString())
    query.set('tab', next)
    router.push(`${pathname}?${query.toString()}`, { scroll: false })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-2 pb-12">
      {tab === 'abertas' ? <OpenBids tab={tab} onSelect={select} /> : <><PageHeading tab={tab} onSelect={select} /><ProcessTab /></>}
    </div>
  )
}
