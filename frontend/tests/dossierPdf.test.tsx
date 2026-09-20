import { describe, it, expect, jest } from '@jest/globals'
import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DossierPdfExport } from '@/components/dossiers/DossierPdfExport'
import type { DossierPdfModel, DossierPdfRendererProps } from '@/lib/dossierPdf'
const model: DossierPdfModel = { slug: 'senado', content: { title: 'Senado', markdown: 'Texto', sourceId: null, codeCommit: 'a'.repeat(40) }, isDraft: true, draftUpdatedAt: '2026-09-20T12:00:00Z', publishedAt: null, publicUrl: 'https://example.org/dossies/senado', filename: 'senado.pdf' }
function Ready({ onStateChange }: DossierPdfRendererProps) { useEffect(() => { onStateChange({ loading: false, url: 'blob:atual', error: null }) }, [onStateChange]); return <div data-testid="preview" data-url="blob:atual">Prévia</div> }
function Loading() { return <p>Gerando PDF…</p> }
function Broken(): never { throw Error('chunk indisponível') }
describe('PDF de dossiê', () => {
  it('prévia e download usam a mesma URL e nome', async () => {
    render(<DossierPdfExport model={model} renderer={Ready} />); fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    const download = await screen.findByRole('link', { name: 'Baixar PDF' }); expect(download).toHaveAttribute('href', screen.getByTestId('preview').getAttribute('data-url')); expect(download).toHaveAttribute('download', 'senado.pdf')
  })
  it('invalida PDF anterior quando o conteúdo muda e ignora conclusão antiga', async () => {
    let oldCallback: DossierPdfRendererProps['onStateChange'] | undefined
    function Delayed({ onStateChange }: DossierPdfRendererProps) { useEffect(() => { oldCallback = onStateChange; onStateChange({ loading: false, url: 'blob:antigo', error: null }) }, [onStateChange]); return null }
    const { rerender } = render(<DossierPdfExport model={model} renderer={Delayed} />); fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' })); await screen.findByRole('link', { name: 'Baixar PDF' })
    rerender(<DossierPdfExport model={{ ...model, content: { ...model.content, markdown: 'Novo texto' } }} renderer={Loading} />)
    act(() => oldCallback?.({ loading: false, url: 'blob:antigo', error: null }))
    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeDisabled(); expect(screen.queryByRole('link', { name: 'Baixar PDF' })).toBeNull()
  })
  it('erro de chunk permite tentar novamente sem habilitar download', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { rerender } = render(<DossierPdfExport model={model} renderer={Broken} />); fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
      expect(await screen.findByText('Não foi possível carregar o gerador de PDF.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeDisabled()
      rerender(<DossierPdfExport model={model} renderer={Ready} />); fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(await screen.findByRole('link', { name: 'Baixar PDF' })).toHaveAttribute('href', 'blob:atual')
    } finally { spy.mockRestore() }
  })
})
