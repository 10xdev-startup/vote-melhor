'use client'

import dynamic from 'next/dynamic'
import { Component, useCallback, useState, type ComponentType, type ReactNode } from 'react'
import { Download, FileDown, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { dossierPdfModelFingerprint, type DossierPdfModel, type DossierPdfRendererProps, type DossierPdfRenderState } from '@/lib/dossierPdf'

type ScopedPdfState = DossierPdfRenderState & { modelFingerprint: string | null; generation: number }

const INITIAL_PDF_STATE: ScopedPdfState = { loading: true, url: null, error: null, modelFingerprint: null, generation: -1 }

function PdfPreviewSkeleton() {
  return (
    <div className="min-h-[420px] flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
      <div className="mx-auto my-5 aspect-[210/297] w-[min(78%,420px)] animate-pulse rounded-sm border border-border bg-background shadow-sm" aria-label="Carregando gerador de PDF" />
    </div>
  )
}

const DynamicDossierPdfRenderer = dynamic<DossierPdfRendererProps>(
  () => import('@/components/dossiers/DossierPdfRenderer').then((module) => module.DossierPdfRenderer),
  { ssr: false, loading: PdfPreviewSkeleton },
)

type BoundaryProps = {
  children: ReactNode
  onError: (message: string) => void
  onRetry: () => void
}

class PdfRendererErrorBoundary extends Component<BoundaryProps, { error: string | null }> {
  state: { error: string | null } = { error: null }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : 'Falha ao carregar o gerador de PDF' }
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error.message)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Não foi possível carregar o gerador de PDF.</p>
        <button type="button" onClick={this.props.onRetry} className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
          Tentar novamente
        </button>
      </div>
    )
  }
}

type Props = {
  model: DossierPdfModel
  /** Injeção estreita para testar os estados do modal sem gerar um PDF em cada caso. */
  renderer?: ComponentType<DossierPdfRendererProps>
}

export function DossierPdfExport({ model, renderer: Renderer = DynamicDossierPdfRenderer }: Props) {
  const modelFingerprint = dossierPdfModelFingerprint(model)
  const [open, setOpen] = useState(false)
  const [rendererKey, setRendererKey] = useState(0)
  const [pdfState, setPdfState] = useState<ScopedPdfState>(INITIAL_PDF_STATE)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    setPdfState(INITIAL_PDF_STATE)
    if (nextOpen) setRendererKey((current) => current + 1)
  }, [])

  const handleRendererError = useCallback((message: string) => {
    setPdfState({ loading: false, url: null, error: message, modelFingerprint, generation: rendererKey })
  }, [modelFingerprint, rendererKey])

  const handleStateChange = useCallback((state: DossierPdfRenderState) => {
    setPdfState({ ...state, modelFingerprint, generation: rendererKey })
  }, [modelFingerprint, rendererKey])

  const retryRenderer = useCallback(() => {
    setPdfState(INITIAL_PDF_STATE)
    setRendererKey((current) => current + 1)
  }, [])

  const downloadReady = pdfState.generation === rendererKey
    && pdfState.modelFingerprint === modelFingerprint
    && !pdfState.loading
    && !pdfState.error
    && Boolean(pdfState.url)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-3 text-center text-xs font-semibold">
          <FileDown aria-hidden />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent hideCloseButton className="flex h-[90dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="relative border-b border-border px-4 py-4 pr-14 md:px-6 md:pr-16" data-testid="report-pdf-header">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Exportar dossiê em PDF</DialogTitle>
            <div className="flex min-w-0 items-center justify-between gap-3" data-testid="report-pdf-header-meta">
              <DialogDescription className="min-w-0 truncate">
                {model.content.title} · {model.isDraft ? 'Rascunho' : 'Publicado'}
              </DialogDescription>
              {downloadReady ? (
                <Button asChild size="sm" className="shrink-0">
                  <a href={pdfState.url!} download={model.filename} aria-label="Baixar PDF">
                    <Download aria-hidden />
                    Baixar PDF
                  </a>
                </Button>
              ) : (
                <Button type="button" size="sm" disabled className="shrink-0" aria-label="Baixar PDF">
                  {pdfState.loading && <Loader2 className="animate-spin" aria-hidden />}
                  Baixar PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:right-6">
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Fechar</span>
          </DialogClose>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/20 p-3 md:p-5" aria-live="polite">
          <PdfRendererErrorBoundary
            key={`${rendererKey}:${modelFingerprint}`}
            onError={handleRendererError}
            onRetry={retryRenderer}
          >
            <Renderer model={model} onStateChange={handleStateChange} />
          </PdfRendererErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  )
}
