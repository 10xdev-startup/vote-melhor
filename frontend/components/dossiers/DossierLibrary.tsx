'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { userService } from '@/services/userService'
import { dossierService } from '@/services/dossierService'
import { Button } from '@/components/ui/button'
import type { DossierSummary } from '@/types/dossier'

export function DossierLibrary({ admin = false, sourceId }: { admin?: boolean; sourceId?: string }) {
  const { user } = useAuth()
  const [canReview, setCanReview] = useState(false)
  const [items, setItems] = useState<DossierSummary[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void (admin ? dossierService.listDrafts() : dossierService.list(sourceId)).then((data) => { if (active) setItems(data) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a biblioteca') })
    return () => { active = false }
  }, [admin, sourceId, attempt])
  useEffect(() => {
    let active = true
    if (user) void userService.getMe().then((profile) => { if (active) setCanReview(profile.role === 'admin') }).catch(() => { if (active) setCanReview(false) })
    return () => { active = false }
  }, [user])
  return <main className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Por dentro dos dados</p>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold tracking-tight">{admin ? 'Revisar dossiês' : 'Dossiês'}</h1>{!admin && user && canReview && <Button asChild variant="outline"><Link href="/admin/dossies">Revisar rascunhos</Link></Button>}{admin && <Link href="/dossies" className="text-sm underline">Biblioteca pública</Link>}</div>
    <p className="mt-3 max-w-2xl text-muted-foreground">{admin ? 'Confira os documentos recebidos e publique quando estiverem prontos.' : 'Como acessamos as fontes oficiais, o que aprendemos e quais são os limites dos dados. Leia e baixe os documentos completos.'}</p>
    {sourceId && <p className="mt-3 text-sm">Fonte: {sourceId} · <Link href="/dossies" className="underline">Ver todas</Link></p>}
    <div className="mt-8 space-y-4">{error ? <div role="alert"><p>{error}</p><Button className="mt-3" onClick={() => { setError(''); setItems(null); setAttempt((n) => n + 1) }}>Tentar novamente</Button></div> : items === null ? <p role="status">Carregando dossiês…</p> : items.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-muted-foreground">{admin ? 'Nenhum rascunho recebido.' : 'Ainda não há dossiês publicados para esta seleção.'}</div> : items.map((item) => <Link key={item.slug} href={`${admin ? '/admin' : ''}/dossies/${item.slug}`} className="block rounded-xl border bg-card p-6 transition-colors hover:border-primary/50">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{admin ? item.published_at ? 'Rascunho · possui publicação' : 'Rascunho · não publicado' : 'Publicado'}</p>
      <h2 className="text-lg font-semibold">{item.title}</h2>
      <p className="mt-3 text-xs text-muted-foreground">{item.sourceId ?? 'Documentação da plataforma'} · {new Date((admin ? item.draft_updated_at : item.published_at) ?? '').toLocaleDateString('pt-BR')}</p>
      <p className="mt-4 text-sm font-medium">{admin ? 'Conferir documento' : 'Ler dossiê'} →</p>
    </Link>)}</div>
  </main>
}
