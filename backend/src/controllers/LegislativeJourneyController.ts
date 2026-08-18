import type { Request, Response } from 'express'
import { LegislativeJourneyModel } from '@/models/LegislativeJourneyModel'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

export const LegislativeJourneyController = {
  async detail(req: Request, res: Response): Promise<void> {
    const id = req.params['id']
    if (!id || Array.isArray(id)) throw new AppError(400, 'Informe a tramitação', 'MISSING_LEGISLATIVE_JOURNEY_ID')
    const journey = await LegislativeJourneyModel.getJourney(id)
    if (!journey) throw new AppError(404, 'Tramitação não encontrada', 'LEGISLATIVE_JOURNEY_NOT_FOUND')
    sendOk(res, journey)
  },
}
