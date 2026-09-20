import { Router } from 'express'
import { DeputyController } from '@/controllers/DeputyController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', DeputyController.list)
router.get('/:id', DeputyController.detail)

export { router as deputyRoutes }

