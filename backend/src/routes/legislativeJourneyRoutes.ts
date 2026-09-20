import { Router } from 'express'
import { LegislativeJourneyController } from '@/controllers/LegislativeJourneyController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/:id', LegislativeJourneyController.detail)

export { router as legislativeJourneyRoutes }
