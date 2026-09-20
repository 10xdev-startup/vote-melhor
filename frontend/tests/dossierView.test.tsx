import { describe, it, expect } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DossierView } from '@/components/dossiers/DossierView'
import { dossierService } from '@/services/dossierService'
import type { Dossier } from '@/types/dossier'
declare const jest: { mock: (name: string, factory: () => unknown) => void; fn: () => unknown }
jest.mock('@/services/dossierService', () => ({ dossierService: { get: jest.fn(), getDraft: jest.fn(), publish: jest.fn() } }))
jest.mock('@/components/dossiers/DossierPdfExport', () => ({ DossierPdfExport: () => <button>Exportar PDF</button> }))
const dossier: Dossier = { slug: 'senado', content: { title: 'Senado', markdown: 'Texto aprovado', sourceId: null, codeCommit: 'a'.repeat(40) }, publishedAt: null, draftUpdatedAt: '2026-09-20T12:00:00.123456+00:00' }
interface AsyncMock { mockResolvedValueOnce: (value: unknown) => void; mockRejectedValueOnce: (value: unknown) => void }
describe('leitura e revisão de dossiês', () => {
  it('público lê sem ação de publicação', async () => {
    (dossierService.get as unknown as AsyncMock).mockResolvedValueOnce({ ...dossier, publishedAt: '2026-09-20T12:00:00Z' })
    render(<DossierView slug="senado" />); expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(await screen.findByRole('heading', { name: 'Senado' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Publicar dossiê' })).toBeNull()
  })
  it('admin confirma revisão e envia exatamente o timestamp recebido', async () => {
    (dossierService.getDraft as unknown as AsyncMock).mockResolvedValueOnce(dossier); (dossierService.publish as unknown as AsyncMock).mockResolvedValueOnce({ published: true })
    render(<DossierView slug="senado" admin />)
    const publish = await screen.findByRole('button', { name: 'Publicar dossiê' }); expect(publish).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(publish)
    await waitFor(() => expect(dossierService.publish).toHaveBeenCalledWith('senado', dossier.draftUpdatedAt))
    expect(await screen.findByRole('button', { name: 'Publicado' })).toBeDisabled()
  })
  it('conflito exige nova conferência antes de tentar publicar', async () => {
    (dossierService.getDraft as unknown as AsyncMock).mockResolvedValueOnce(dossier); (dossierService.publish as unknown as AsyncMock).mockRejectedValueOnce(Error('O rascunho mudou. Recarregue.'))
    render(<DossierView slug="senado" admin />); const publish = await screen.findByRole('button', { name: 'Publicar dossiê' }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(publish)
    expect(await screen.findByText('O rascunho mudou. Recarregue.')).toBeInTheDocument(); expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(publish).toBeDisabled()
  })
  it('acesso negado não monta o conteúdo privado', async () => {
    (dossierService.getDraft as unknown as AsyncMock).mockRejectedValueOnce(Error('Acesso negado'))
    render(<DossierView slug="senado" admin />); expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado'); expect(screen.queryByText('Texto aprovado')).toBeNull()
  })
})
