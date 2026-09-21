import type { Request, Response, NextFunction } from 'express'
import { DossierModel } from '@/models/DossierModel'
import { validateDossier, validateDossierSlug } from '@/utils/validateDossier'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'

export function requireDossierAuthor(req: Request, _res: Response, next: NextFunction): void {
  if (!process.env['DOSSIER_AUTHOR_USER_ID'] || req.user?.id !== process.env['DOSSIER_AUTHOR_USER_ID']) throw new AppError(403, 'Conta não autorizada a enviar dossiês', 'DOSSIER_AUTHOR_REQUIRED')
  next()
}

export const DossierController = {
  async saveDraft(req: Request, res: Response): Promise<void> {
    const slug = validateDossierSlug(req.params['slug'])
    const row = await DossierModel.saveDraft(slug, validateDossier(req.body), req.user!.id)
    sendOk(res, { slug: row.slug, draftUpdatedAt: row.draft_updated_at, reviewPath: `/admin/dossies/${row.slug}` })
  },
  async listDrafts(_req: Request, res: Response): Promise<void> { sendOk(res, await DossierModel.listDrafts()) },
  async getDraft(req: Request, res: Response): Promise<void> {
    const row = await DossierModel.getDraft(validateDossierSlug(req.params['slug']))
    sendOk(res, { slug: row.slug, content: row.draft, draftUpdatedAt: row.draft_updated_at, publishedAt: row.published_at })
  },
  async publish(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown> | undefined
    if (!body || Object.keys(body).join(',') !== 'draftUpdatedAt' || typeof body['draftUpdatedAt'] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(body['draftUpdatedAt'])) throw new AppError(400, 'Informe a data exata do rascunho conferido', 'INVALID_DRAFT_TIMESTAMP')
    await DossierModel.publish(validateDossierSlug(req.params['slug']), body['draftUpdatedAt'], req.user!.id)
    sendOk(res, { published: true })
  },
  async listPublished(req: Request, res: Response): Promise<void> {
    const source = req.query['sourceId']
    if (source !== undefined && (typeof source !== 'string' || source.length > 120)) throw new AppError(400, 'Filtro de fonte inválido', 'INVALID_SOURCE')
    sendOk(res, await DossierModel.listPublished(source as string | undefined))
  },
  async getPublished(req: Request, res: Response): Promise<void> { sendOk(res, await DossierModel.getPublished(validateDossierSlug(req.params['slug']))) },
}
