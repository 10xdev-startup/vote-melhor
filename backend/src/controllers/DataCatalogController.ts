import type { Request, Response } from 'express'
import { DataCatalogModel } from '@/models/DataCatalogModel'
import { parseFinancialReport, parseSpreadsheet, SpreadsheetParseError } from '@/utils/parseSpreadsheet'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'
import { fetchSourceFile } from '@/utils/fetchSourceFile'
import type { FilePreview } from '@/types/dataCatalog'

/** Amostra default e teto. O preview e para reconhecer o arquivo, nao para consumi-lo. */
const DEFAULT_PREVIEW_ROWS = 20
const MAX_PREVIEW_ROWS = 200

function resolveLimit(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PREVIEW_ROWS
  return Math.min(parsed, MAX_PREVIEW_ROWS)
}

export const DataCatalogController = {
  /** Catalogo completo (GET /data-sources). */
  list(_req: Request, res: Response): void {
    sendOk(res, DataCatalogModel.listDatasets())
  },

  /**
   * Amostra do conteudo (GET /data-sources/files/:id/preview).
   *
   * A URL vem SEMPRE do catalogo, resolvida pelo id — nunca da request. E isso que impede o
   * endpoint de virar um proxy aberto de saida.
   */
  async preview(req: Request, res: Response): Promise<void> {
    const fileId = req.params['id']
    if (!fileId || Array.isArray(fileId)) {
      throw new AppError(400, 'Informe o id do arquivo', 'MISSING_FILE_ID')
    }

    const file = DataCatalogModel.findFileById(fileId)
    if (!file) throw new AppError(404, 'Arquivo não encontrado no catálogo', 'FILE_NOT_FOUND')

    const buffer = await fetchSourceFile(file.url)

    try {
      if (file.layout === 'report') {
        if (file.format !== 'CSV') {
          throw new AppError(422, 'Formato de relatório ainda não suportado', 'REPORT_FORMAT_UNSUPPORTED')
        }

        const parsed = parseFinancialReport(buffer, file.format, resolveLimit(req.query['limit']))
        const preview: FilePreview = {
          layout: 'report',
          fileId: file.id,
          title: parsed.title,
          metadata: parsed.metadata,
          rows: parsed.rows,
          columnCount: parsed.columnCount,
          rowCount: parsed.rows.length,
          totalRowCount: parsed.totalRowCount,
          truncated: parsed.truncated,
        }
        sendOk(res, preview)
        return
      }

      const parsed = parseSpreadsheet(buffer, file.format, resolveLimit(req.query['limit']))
      const preview: FilePreview = {
        layout: 'tabular',
        fileId: file.id,
        columns: parsed.columns,
        rows: parsed.rows,
        rowCount: parsed.rows.length,
        totalRowCount: parsed.totalRowCount,
        columnTotals: parsed.columnTotals,
        truncated: parsed.truncated,
      }
      sendOk(res, preview)
    } catch (error) {
      if (error instanceof SpreadsheetParseError) {
        throw new AppError(422, error.message, error.code.toUpperCase())
      }
      throw error
    }
  },
}
