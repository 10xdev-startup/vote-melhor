import type { Request, Response } from 'express'
import { VotacaoModel } from '@/models/VotacaoModel'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'

export const VotacaoController = {
  /** Votações nominais do recorte (GET /votacoes). */
  async list(_req: Request, res: Response): Promise<void> {
    sendOk(res, await VotacaoModel.listVotacoes())
  },

  /** Uma pauta com o voto de cada senador (GET /votacoes/:id). */
  async detail(req: Request, res: Response): Promise<void> {
    const id = req.params['id']
    if (!id || Array.isArray(id)) throw new AppError(400, 'Informe o id da votação', 'MISSING_VOTACAO_ID')

    const votacao = await VotacaoModel.getVotacao(id)
    if (!votacao) throw new AppError(404, 'Votação não encontrada no período coberto', 'VOTACAO_NOT_FOUND')

    sendOk(res, votacao)
  },
}
