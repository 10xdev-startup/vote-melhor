import type { Request, Response } from 'express'
import { SenatorModel } from '@/models/SenatorModel'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'

export const SenatorController = {
  /** Senadores em exercício com o retrospecto de votação (GET /senators). */
  async list(_req: Request, res: Response): Promise<void> {
    sendOk(res, await SenatorModel.listSenators())
  },

  /** Retrospecto voto a voto de um senador (GET /senators/:code). */
  async detail(req: Request, res: Response): Promise<void> {
    const raw = req.params['code']
    const code = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
    if (!Number.isFinite(code) || code <= 0) {
      throw new AppError(400, 'Informe o código do senador', 'INVALID_SENATOR_CODE')
    }

    const senator = await SenatorModel.getSenator(code)
    if (!senator) throw new AppError(404, 'Senador não está em exercício', 'SENATOR_NOT_FOUND')

    sendOk(res, senator)
  },
}
