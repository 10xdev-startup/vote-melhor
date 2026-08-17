import { Router } from 'express'
import { VotacaoController } from '@/controllers/VotacaoController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

// Mesma decisao das demais rotas de dado publico: a pagina e logada, entao a API tambem
// exige sessao. O dado em si e publico — abrir depois e remover esta linha.
router.use(supabaseMiddleware)

router.get('/', VotacaoController.list)
router.get('/:id', VotacaoController.detail)

export { router as votacaoRoutes }
