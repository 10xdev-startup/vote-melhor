import { Router } from 'express'
import { LegislativeJourneyController } from '@/controllers/LegislativeJourneyController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

router.use(supabaseMiddleware)
router.get('/:id', LegislativeJourneyController.detail)

export { router as legislativeJourneyRoutes }
