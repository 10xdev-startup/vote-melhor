'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function PdfPageCanvas({ document, pageNumber, width, scrollRoot }: { document: PDFDocumentProxy; pageNumber: number; width: number; scrollRoot: HTMLElement }) {
  const holderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { root: scrollRoot, rootMargin: '500px 0px' })
    observer.observe(holder)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!visible) return
    let active = true
    let renderTask: RenderTask | null = null

    const renderPage = async () => {
      const page = await document.getPage(pageNumber)
      if (!active || !canvasRef.current) return

      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(1.4, width / baseViewport.width)
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: scale * pixelRatio })
      const canvas = canvasRef.current
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`
      canvas.style.height = `${Math.ceil(viewport.height / pixelRatio)}px`
      renderTask = page.render({ canvas, viewport })
      await renderTask.promise
      if (active) setLoading(false)
    }

    void renderPage().catch(() => {
      if (!active) return // error-policy: expected -- render anterior foi cancelado ao trocar de página.
      setError(true)
      setLoading(false)
    })

    return () => {
      active = false
      renderTask?.cancel()
    }
  }, [document, pageNumber, visible, width])

  return (
    <div ref={holderRef} className="mx-auto space-y-1" style={{ width: Math.min(width, 834) }}>
      <p className="text-right text-xs text-muted-foreground">Página {pageNumber} de {document.numPages}</p>
      <div className="relative aspect-[210/297] w-full bg-white shadow-sm">
        {visible && !error && <canvas ref={canvasRef} aria-label={`Página ${pageNumber} do PDF`} className="block max-w-full" />}
        {visible && loading && !error && <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renderizando página…</div>}
        {error && <p className="p-6 text-center text-sm text-destructive">Não foi possível mostrar esta página. O PDF ainda pode ser baixado.</p>}
      </div>
    </div>
  )
}

export function DossierPdfPreview({ blob }: { blob: Blob }) {
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [width, setWidth] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!viewportElement) return
    const observer = new ResizeObserver(() => setWidth(Math.max(0, viewportElement.clientWidth - 32)))
    observer.observe(viewportElement)
    return () => observer.disconnect()
  }, [viewportElement])

  useEffect(() => {
    let active = true
    let loadingTask: PDFDocumentLoadingTask | null = null

    const loadDocument = async () => {
      const data = new Uint8Array(await blob.arrayBuffer())
      if (!active) return
      loadingTask = getDocument({ data })
      const pdf = await loadingTask.promise
      if (active) setDocument(pdf)
    }

    void loadDocument().catch(() => {
      if (!active) return // error-policy: expected -- modal fechado antes de terminar a leitura.
      setError(true)
    })

    return () => {
      active = false
      void loadingTask?.destroy()
    }
  }, [blob])

  return (
    <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30">
      <div ref={setViewportElement} aria-label="Prévia do PDF" className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        {error ? (
          <p className="p-6 text-center text-sm text-destructive">Não foi possível mostrar a prévia. O PDF ainda pode ser baixado.</p>
        ) : document && width > 0 && viewportElement ? (
          Array.from({ length: document.numPages }, (_, index) => (
            <PdfPageCanvas key={`${index + 1}:${width}`} document={document} pageNumber={index + 1} width={width} scrollRoot={viewportElement} />
          ))
        ) : (
          <div className="mx-auto aspect-[210/297] w-[min(78%,420px)] animate-pulse rounded-sm border border-border bg-background shadow-sm" aria-label="Preparando prévia do PDF" />
        )}
      </div>
    </div>
  )
}
