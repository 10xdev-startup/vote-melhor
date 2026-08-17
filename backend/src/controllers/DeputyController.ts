import type { Request, Response } from 'express'
import { DeputyModel } from '@/models/DeputyModel'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

export const DeputyController = {
  /** Deputados em exercício com escolhas publicadas em 2026 (GET /deputies). */
  async list(_req: Request, res: Response): Promise<void> {
    sendOk(res, await DeputyModel.listDeputies())
  },

  /** Retrospecto voto a voto de um deputado atual (GET /deputies/:id). */
  async detail(req: Request, res: Response): Promise<void> {
    const raw = req.params['id']
    const id = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError(400, 'Informe o código do deputado', 'INVALID_DEPUTY_ID')
    }

    const deputy = await DeputyModel.getDeputy(id)
    if (!deputy) throw new AppError(404, 'Deputado não está em exercício', 'DEPUTY_NOT_FOUND')
    sendOk(res, deputy)
  },
}

