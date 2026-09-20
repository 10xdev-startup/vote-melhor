import { Router } from 'express'
import { CamaraVotingController } from '@/controllers/CamaraVotingController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', CamaraVotingController.list)
router.get('/:id', CamaraVotingController.detail)

export { router as camaraVotingRoutes }
