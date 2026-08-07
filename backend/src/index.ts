import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { sendOk } from '@/utils/apiResponse'
import { userRoutes } from '@/routes/userRoutes'
import { errorHandler } from '@/middleware'

dotenv.config()

const app = express()
const PORT = process.env['PORT'] || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  // Envelope wrapped (blueprint §4): todo controller responde via sendOk/sendError.
  sendOk(res, { status: 'ok' })
})

// Dominio de referencia: usuario (Controller → Model → Database).
app.use('/users', userRoutes)

// Handler de erro central — por ULTIMO, depois das rotas (serializa AppError no envelope).
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`)
})
