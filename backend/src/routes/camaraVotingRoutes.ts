import { Router } from 'express'
import { CamaraVotingController } from '@/controllers/CamaraVotingController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

// Mantém a decisão atual das demais rotas de dados públicos até a abertura conjunta da API.
router.use(supabaseMiddleware)

router.get('/', CamaraVotingController.list)
router.get('/:id', CamaraVotingController.detail)

export { router as camaraVotingRoutes }
