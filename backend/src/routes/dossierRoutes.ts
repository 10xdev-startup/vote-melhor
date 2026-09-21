import { Router, json } from 'express'
import { supabaseMiddleware, requireAdmin } from '@/middleware'
import { DossierController, requireDossierAuthor } from '@/controllers/DossierController'

const router = Router()
// Montar antes do parser global: autenticar antes de aceitar um corpo maior.
router.put('/:slug/draft', supabaseMiddleware, requireDossierAuthor, json({ limit: '1mb' }), DossierController.saveDraft)
router.get('/admin', supabaseMiddleware, requireAdmin, DossierController.listDrafts)
router.get('/admin/:slug', supabaseMiddleware, requireAdmin, DossierController.getDraft)
router.post('/admin/:slug/publish', supabaseMiddleware, requireAdmin, json({ limit: '2kb' }), DossierController.publish)
router.get('/', DossierController.listPublished)
router.get('/:slug', DossierController.getPublished)
export { router as dossierRoutes }
