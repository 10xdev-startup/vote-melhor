'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { dossierService } from '@/services/dossierService'
import { DossierContent } from '@/components/dossiers/DossierContent'
import { DossierPdfExport } from '@/components/dossiers/DossierPdfExport'
import { Button } from '@/components/ui/button'
import type { Dossier } from '@/types/dossier'
import type { DossierPdfModel } from '@/lib/dossierPdf'

function LoadedDossier({ dossier, admin, reload }: { dossier: Dossier; admin: boolean; reload: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(false)
  const model = useMemo<DossierPdfModel>(() => ({ ...dossier, isDraft: admin, publicUrl: `${window.location.origin}/dossies/${dossier.slug}`, filename: `${dossier.slug}-${admin ? 'rascunho-' : ''}${(admin ? dossier.draftUpdatedAt : dossier.publishedAt)?.slice(0, 10)}.pdf` }), [dossier, admin])
  async function publish() {
    if (!confirmed || !dossier.draftUpdatedAt || busy) return
    setBusy(true); setMessage('')
    try { await dossierService.publish(dossier.slug, dossier.draftUpdatedAt); setPublished(true); setMessage('Dossiê publicado. A cópia pública já pode ser compartilhada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível publicar'); setConfirmed(false) }
    finally { setBusy(false) }
  }
  return <>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <Link href={admin ? '/admin/dossies' : '/dossies'} className="text-sm text-muted-foreground underline">← {admin ? 'Revisão de dossiês' : 'Todos os dossiês'}</Link>
      <DossierPdfExport model={model} />
    </div>
    {admin && <aside className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
      <h2 className="font-semibold">Revisar rascunho</h2>
      <p className="mt-2 text-sm text-muted-foreground">O envio não publica. Confira o texto, as fontes e o PDF antes de disponibilizar este conteúdo. Uma publicação anterior permanece visível até você publicar novamente.</p>
      <label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || published} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />Conferi o conteúdo, as fontes e o PDF.</label>
      <div className="flex flex-wrap gap-3"><Button disabled={!confirmed || busy || published} onClick={() => void publish()}>{busy ? 'Publicando…' : published ? 'Publicado' : 'Publicar dossiê'}</Button><Button variant="outline" disabled={busy} onClick={reload}>Recarregar rascunho</Button>{(published || dossier.publishedAt) && <Button asChild variant="outline"><Link href={`/dossies/${dossier.slug}`}>Ver publicação</Link></Button>}</div>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </aside>}
    <DossierContent dossier={dossier} isDraft={admin} />
  </>
}
export function DossierView({ slug, admin = false }: { slug: string; admin?: boolean }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void (admin ? dossierService.getDraft(slug) : dossierService.get(slug)).then((data) => { if (active) setDossier(data) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o dossiê') })
    return () => { active = false }
  }, [slug, admin, attempt])
  const reload = () => { setDossier(null); setError(''); setAttempt((n) => n + 1) }
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-12">{error ? <div role="alert" className="space-y-4"><p>{error}</p><Button onClick={reload}>Tentar novamente</Button><Link href="/dossies" className="ml-4 underline">Voltar à biblioteca</Link></div> : dossier ? <LoadedDossier key={`${slug}:${attempt}`} dossier={dossier} admin={admin} reload={reload} /> : <p role="status">Carregando dossiê…</p>}</main>
}
