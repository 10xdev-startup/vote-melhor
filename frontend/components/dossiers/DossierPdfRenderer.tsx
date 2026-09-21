'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { DossierPdfDocument, prepareDossierPdf, registerDossierFonts } from '@/components/dossiers/DossierPdfDocument'
import { DossierPdfPreview } from '@/components/dossiers/DossierPdfPreview'
import type { DossierPdfRendererProps } from '@/lib/dossierPdf'

registerDossierFonts()

function GeneratedPdf({ model, onStateChange }: DossierPdfRendererProps) {
  const document = useMemo(() => <DossierPdfDocument model={model} />, [model])
  const [instance, update] = usePDF({ document })
  useEffect(() => { onStateChange({ loading: instance.loading, url: instance.url, error: instance.error }) }, [instance.loading, instance.url, instance.error, onStateChange])
  if (instance.error) return <div role="alert" className="p-6 text-center"><p>Não foi possível gerar o PDF.</p><button className="mt-3 underline" onClick={() => { onStateChange({ loading: true, url: null, error: null }); update(document) }}>Tentar novamente</button></div>
  if (instance.blob && instance.url && !instance.loading) return <DossierPdfPreview key={instance.url} blob={instance.blob} />
  return <p className="p-8 text-center text-muted-foreground">Gerando PDF…</p>
}
export function DossierPdfRenderer(props: DossierPdfRendererProps) {
  const [state, setState] = useState<'loading' | 'ready' | string>('loading')
  const [attempt, setAttempt] = useState(0)
  const { model, onStateChange } = props
  useEffect(() => {
    let active = true
    void prepareDossierPdf(model).then(() => { if (active) setState('ready') }).catch((error: unknown) => {
      if (!active) return
      const message = error instanceof Error ? error.message : 'Falha ao preparar o PDF'
      setState(message); onStateChange({ loading: false, url: null, error: message })
    })
    return () => { active = false }
  }, [model, onStateChange, attempt])
  if (state === 'ready') return <GeneratedPdf {...props} />
  if (state !== 'loading') return <div role="alert" className="p-8 text-center"><p>{state}</p><button className="mt-3 underline" onClick={() => { setState('loading'); onStateChange({ loading: true, url: null, error: null }); setAttempt((n) => n + 1) }}>Tentar novamente</button></div>
  return <p className="p-8 text-center">Preparando fontes e conteúdo…</p>
}
