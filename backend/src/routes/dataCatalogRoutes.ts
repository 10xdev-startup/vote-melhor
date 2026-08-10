import { Router } from 'express'
import { DataCatalogController } from '@/controllers/DataCatalogController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

// A pagina Fonte de dados e logada, entao a API que a serve tambem exige sessao. O dado em si
// e publico: abrir estas rotas depois e remover esta linha, sem tocar em controller nem model.
router.use(supabaseMiddleware)

router.get('/', DataCatalogController.list)
router.get('/files/:id/preview', DataCatalogController.preview)

export { router as dataCatalogRoutes }
