import type { Request, Response } from 'express'
import { LICITAR_DOCUMENTS } from '@/adapters/licitarDigital'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { BID_REFINEMENTS, BID_TOPICS, type BidQuery } from '@/services/federalBids'
import { allowedDocumentUrl, lookupBidDocuments, zipPdfBytes } from '@/services/bidDocuments'
import { listStoredOpenBids } from '@/services/storedBids'
import { officialHttpGet } from '@/utils/officialHttpGet'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'

const ESFERAS = new Set(['', 'F', 'E', 'M', 'D'])
const MODALIDADES = new Set(['', '1', '4', '6', '8'])

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export const ProcurementController = {
  async openFederal(req: Request, res: Response) {
    const esfera = text(req.query['esfera']).toUpperCase()
    const modalidade = text(req.query['modalidade'])
    const assunto = text(req.query['assunto']) in BID_TOPICS ? text(req.query['assunto']) : ''
    const recorte = text(req.query['recorte'])
    const query: BidQuery = {
      uf: text(req.query['uf']).toUpperCase().slice(0, 2),
      cidade: text(req.query['cidade']).slice(0, 80),
      esfera: req.query['esfera'] === undefined ? 'F' : ESFERAS.has(esfera) ? esfera : 'F',
      modalidade: req.query['modalidade'] === undefined ? '6' : MODALIDADES.has(modalidade) ? modalidade : '6',
      assunto,
      recorte: BID_REFINEMENTS[assunto]?.[recorte] ? recorte : '',
    }
    const pagina = text(req.query['pagina'])
    const page = /^\d+$/.test(pagina) ? Math.min(100000, Math.max(1, Number(pagina))) : 1
    sendOk(res, await listStoredOpenBids(query, new Date(), page))
  },
  async documentos(req: Request, res: Response) {
    const pncpUrl = text(req.query['pncpUrl'])
    const disputa = text(req.query['disputaUrl'])
    sendOk(res, await lookupBidDocuments(pncpUrl, disputa || null))
  },
  async documento(req: Request, res: Response) {
    const url = allowedDocumentUrl(text(req.query['url']))
    const arquivo = text(req.query['arquivo']).slice(0, 180)
    const response = await officialHttpGet(url.toString(), { timeoutMs: 45000, allowedHosts: [url.hostname], maxBytes: 20_000_000 })
    if (response.status !== 200) throw new AppError(502, 'A origem não devolveu o PDF', 'DOCUMENT_UNAVAILABLE')
    const body = arquivo ? zipPdfBytes(response.body, arquivo) : response.body
    if (!body || body.subarray(0, 5).toString('ascii') !== '%PDF-') throw new AppError(502, 'A origem não devolveu o PDF', 'DOCUMENT_UNAVAILABLE')
    sendPdf(res, body, arquivo || 'documento.pdf', req.headers.range)
  },
  async anexo(req: Request, res: Response) {
    const name = typeof req.params['name'] === 'string' ? req.params['name'] : ''
    const document = LICITAR_DOCUMENTS.find((item) => item.name === name)
    if (!document) throw new AppError(404, 'Anexo não encontrado', 'ANEXO_NOT_FOUND')
    const body = await OfficialDataModel.storedOriginal('licitar-digital', document.name)
    if (!body) throw new AppError(404, 'Anexo ainda não está no acervo', 'ANEXO_NOT_READY')
    sendPdf(res, body, document.fileName, req.headers.range)
  },
}

/** O visualizador de PDF pede o arquivo em pedaços. Sem isso a página abre e fica vazia. */
function sendPdf(res: Response, body: Buffer, fileName: string, rangeHeader: string | undefined): void {
  const total = body.length
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!rangeHeader) {
    res.setHeader('Content-Length', String(total))
    res.end(body)
    return
  }
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
    return
  }
  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : total - 1
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= total) {
    res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
    return
  }
  const last = Math.min(end, total - 1)
  const chunk = body.subarray(start, last + 1)
  res.status(206)
  res.setHeader('Content-Range', `bytes ${start}-${last}/${total}`)
  res.setHeader('Content-Length', String(chunk.length))
  res.end(chunk)
}
