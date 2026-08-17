import type { Request, Response } from 'express'
import { CamaraVotingModel } from '@/models/CamaraVotingModel'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

export const CamaraVotingController = {
  /** Proposições e votações nominais do Plenário em 2026 (GET /camara/votacoes). */
  async list(_req: Request, res: Response): Promise<void> {
    sendOk(res, await CamaraVotingModel.listVotings())
  },

  /** Uma votação com todas as posições publicadas (GET /camara/votacoes/:id). */
  async detail(req: Request, res: Response): Promise<void> {
    const id = req.params['id']
    if (!id) throw new AppError(400, 'Informe o id da votação', 'MISSING_CAMARA_VOTING_ID')

    const voting = await CamaraVotingModel.getVoting(id)
    if (!voting) throw new AppError(404, 'Votação não encontrada no recorte de 2026', 'CAMARA_VOTING_NOT_FOUND')
    sendOk(res, voting)
  },
}
