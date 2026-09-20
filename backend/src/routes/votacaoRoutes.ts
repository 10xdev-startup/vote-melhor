import { Router } from 'express'
import { VotacaoController } from '@/controllers/VotacaoController'

const router = Router()

// Rota publica: dado oficial, sem req.user. O gate de conta vive em /users.
router.get('/', VotacaoController.list)
router.get('/:id', VotacaoController.detail)

export { router as votacaoRoutes }
