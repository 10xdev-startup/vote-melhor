import type { Request, Response } from 'express'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'

function parameter(req: Request, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new AppError(400, 'Identificador inválido', 'INVALID_RESOURCE_ID')
  return value
}
function integer(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'Parâmetro numérico inválido', 'INVALID_PAGINATION')
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new AppError(400, 'Parâmetro fora do limite', 'INVALID_PAGINATION')
  return parsed
}

export const OfficialDataController = {
  async list(req: Request, res: Response): Promise<void> { sendOk(res, await OfficialDataModel.listSources(integer(req.query['page'], 1, 1000000), integer(req.query['limit'], 50, 100))) },
  async resources(req: Request, res: Response): Promise<void> { sendOk(res, await OfficialDataModel.listResources(parameter(req, 'sourceId'), integer(req.query['page'], 1, 1000000), integer(req.query['limit'], 50, 100))) },
  async preview(req: Request, res: Response): Promise<void> {
    const page = integer(req.query['page'], 1, 1000000)
    const limit = integer(req.query['limit'], 20, 200)
    const year = req.query['year'] === undefined ? null : integer(req.query['year'], 1, 9999)
    const resource = await OfficialDataModel.getReadyResource(parameter(req, 'sourceId'), parameter(req, 'name'))
    sendOk(res, await OfficialDataModel.recordsPage(resource, year, page, limit))
  },
  async original(req: Request, res: Response): Promise<void> {
    const resource = await OfficialDataModel.getReadyResource(parameter(req, 'sourceId'), parameter(req, 'name'))
    sendOk(res, await OfficialDataModel.originalUrl(resource))
  },
}
