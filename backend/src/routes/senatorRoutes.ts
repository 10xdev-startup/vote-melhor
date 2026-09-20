import { Router } from 'express'
import { SenatorController } from '@/controllers/SenatorController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', SenatorController.list)
router.get('/:code', SenatorController.detail)

export { router as senatorRoutes }
