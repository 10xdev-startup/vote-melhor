import { Router } from 'express'
import { ProcurementController } from '@/controllers/ProcurementController'

const router = Router()

router.get('/abertas', ProcurementController.openFederal)
router.get('/documentos', ProcurementController.documentos)
router.get('/documento', ProcurementController.documento)
router.get('/anexos/:name', ProcurementController.anexo)

export { router as procurementRoutes }
