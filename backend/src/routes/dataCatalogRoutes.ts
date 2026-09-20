import { Router } from 'express'
import { DataCatalogController } from '@/controllers/DataCatalogController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', DataCatalogController.list)
router.get('/roadmap', DataCatalogController.roadmap)
router.get('/files/:id/preview', DataCatalogController.preview)

export { router as dataCatalogRoutes }
