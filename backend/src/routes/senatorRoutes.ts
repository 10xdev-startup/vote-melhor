import { Router } from 'express'
import { SenatorController } from '@/controllers/SenatorController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

// Mesma decisao das rotas de Fonte de dados: a pagina e logada, entao a API que a serve
// tambem exige sessao. O dado em si e publico — abrir depois e remover esta linha.
router.use(supabaseMiddleware)

router.get('/', SenatorController.list)
router.get('/:code', SenatorController.detail)

export { router as senatorRoutes }
