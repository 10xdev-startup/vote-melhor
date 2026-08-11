import type { Request, Response } from 'express'
import { DataCatalogModel } from '@/models/DataCatalogModel'
import { DataRoadmapModel } from '@/models/DataRoadmapModel'
import { parseFinancialReport, parseSpreadsheet, SpreadsheetParseError, type SpreadsheetFilter } from '@/utils/parseSpreadsheet'
import { sendOk } from '@/utils/apiResponse'
import { AppError } from '@/utils/AppError'
import { fetchSourceFile } from '@/utils/fetchSourceFile'
import type { FilePreview } from '@/types/dataCatalog'

/** Tamanho padrão e teto de cada página do visualizador. */
const DEFAULT_PREVIEW_ROWS = 20
const MAX_PREVIEW_ROWS = 200
const MAX_PREVIEW_PAGE = 1_000_000
const MAX_PREVIEW_FILTERS = 10

function resolveLimit(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PREVIEW_ROWS
  return Math.min(parsed, MAX_PREVIEW_ROWS)
}

function resolvePage(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.min(parsed, MAX_PREVIEW_PAGE)
}

function resolveFilters(raw: unknown): SpreadsheetFilter[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const filters = parsed.filter((item): item is SpreadsheetFilter => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      if (typeof candidate['column'] !== 'string' || candidate['column'].length > 200) return false
      if (candidate['operator'] === 'equals') return typeof candidate['value'] === 'string' && candidate['value'].length <= 500
      if (candidate['operator'] !== 'range') return false
      const minIsValid = candidate['min'] === undefined || (typeof candidate['min'] === 'string' && candidate['min'].length <= 100)
      const maxIsValid = candidate['max'] === undefined || (typeof candidate['max'] === 'string' && candidate['max'].length <= 100)
      return minIsValid && maxIsValid && (candidate['min'] !== undefined || candidate['max'] !== undefined)
    })
    return [...new Map(filters.slice(0, MAX_PREVIEW_FILTERS).map((filter) => [filter.column, filter])).values()]
  } catch {
    return []
  }
}

export const DataCatalogController = {
  /** Catalogo completo (GET /data-sources). */
  list(_req: Request, res: Response): void {
    sendOk(res, DataCatalogModel.listDatasets())
  },

  /** Roadmap completo, incluindo o que já existe e as próximas integrações. */
  roadmap(_req: Request, res: Response): void {
    sendOk(res, DataRoadmapModel.listSections())
  },

  /**
   * Página do conteúdo (GET /data-sources/files/:id/preview?page=1&limit=20).
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
    const pageSize = resolveLimit(req.query['limit'])
    const page = resolvePage(req.query['page'])
    const filters = resolveFilters(req.query['filters'])
    const offset = (page - 1) * pageSize

    try {
      if (file.layout === 'report') {
        if (file.format !== 'CSV') {
          throw new AppError(422, 'Formato de relatório ainda não suportado', 'REPORT_FORMAT_UNSUPPORTED')
        }

        const parsed = parseFinancialReport(buffer, file.format, pageSize, offset)
        const preview: FilePreview = {
          layout: 'report',
          fileId: file.id,
          title: parsed.title,
          metadata: parsed.metadata,
          rows: parsed.rows,
          columnCount: parsed.columnCount,
          rowCount: parsed.rows.length,
          totalRowCount: parsed.totalRowCount,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(parsed.totalRowCount / pageSize)),
          truncated: parsed.truncated,
        }
        sendOk(res, preview)
        return
      }

      const parsed = parseSpreadsheet(buffer, file.format, pageSize, offset, filters)
      const preview: FilePreview = {
        layout: 'tabular',
        fileId: file.id,
        columns: parsed.columns,
        rows: parsed.rows,
        rowCount: parsed.rows.length,
        totalRowCount: parsed.totalRowCount,
        unfilteredRowCount: parsed.unfilteredRowCount,
        appliedFilters: parsed.appliedFilters,
        facets: parsed.facets,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(parsed.totalRowCount / pageSize)),
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
