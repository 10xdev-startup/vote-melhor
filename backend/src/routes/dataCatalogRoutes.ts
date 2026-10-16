import { Router } from 'express'
import { DataCatalogController } from '@/controllers/DataCatalogController'
import { OfficialDataController } from '@/controllers/OfficialDataController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', DataCatalogController.list)
router.get('/roadmap', DataCatalogController.roadmap)
router.get('/files/:id/preview', DataCatalogController.preview)
router.get('/persisted', OfficialDataController.list)
router.get('/persisted/:sourceId/resources', OfficialDataController.resources)
router.get('/persisted/:sourceId/resources/:name/preview', OfficialDataController.preview)
router.get('/persisted/:sourceId/resources/:name/original', OfficialDataController.original)

export { router as dataCatalogRoutes }
