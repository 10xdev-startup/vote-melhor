import { Router } from 'express'
import { DeputyController } from '@/controllers/DeputyController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

// Mantém a decisão atual das outras rotas públicas servidas dentro do dashboard. Abrir
// /data-sources, /senators, /votacoes e /deputies é uma decisão conjunta ainda pendente.
router.use(supabaseMiddleware)

router.get('/', DeputyController.list)
router.get('/:id', DeputyController.detail)

export { router as deputyRoutes }

