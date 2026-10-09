import { DataCatalogModel } from '@/models/DataCatalogModel'
import { parseFinancialReport, parseSpreadsheet } from '@/utils/parseSpreadsheet'
import { buildSpFazendaRequestBody, fetchSpFazendaOriginal, parseSpFazendaExpensesXml, renderSpFazendaExpenses } from '@/utils/fetchSpFazendaExpenses'
import type { DataFile, DatasetEdition } from '@/types/dataCatalog'
import type { ImportResource, OfficialDataAdapter } from '@/types/officialData'

/** Deriva o arquivo de coleta do mesmo catálogo que a interface usa; sem duplicar URLs. */
export function createCatalogArchiveAdapters(): OfficialDataAdapter[] {
  return DataCatalogModel.listDatasets().map((dataset) => ({
    id: dataset.id,
    allowedHosts: [...new Set(dataset.editions.flatMap((edition) => edition.files.map((file) => new URL(file.url).hostname)))],
    discover: async () => ({
      source: { id: dataset.id, title: dataset.title, organization: dataset.organ, jurisdiction_code: dataset.id.startsWith('sp-') ? '35' : 'BR', official_url: dataset.officialUrl, metadata: { description: dataset.description, group: dataset.group, updateFrequencyDeclared: dataset.updateFrequency, catalogCollectedAt: dataset.collectedAt, archiveOnly: true, sourceSystem: dataset.sourceSystem } },
      resources: dataset.editions.flatMap((edition) => edition.files.map((file) => archiveResource(file, edition))),
    }),
  }))
}

function archiveResource(file: DataFile, edition: DatasetEdition): ImportResource {
  let evidence: Record<string, unknown> = {}
  const query = file.sourceQuery
  const request = query ? { method: 'POST', url: file.url, parameters: query, body: buildSpFazendaRequestBody(query.year), headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'http://fazenda.sp.gov.br/wstransparencia/ConsultarDespesasDotacao' } } : { method: 'GET', url: file.url }
  return {
    name: file.id, title: file.name, official_id: null, url: file.url, format: file.format, kind: 'document',
    schema: { purpose: 'original-archive', format: file.format, layout: file.layout, edition: { id: edition.id, year: edition.year }, request },
    parserVersion: 'catalog-archive-v1', dependencies: [], optional: true,
    ...(query ? { load: async () => fetchSpFazendaOriginal(query.year) } : {}),
    parse: (body) => {
      if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body.toString('utf8', 0, 256))) throw new Error('Origem devolveu HTML em vez do arquivo')
      if (query) {
        const items = parseSpFazendaExpensesXml(body.toString('utf8'))
        if (!items.length) throw new Error('SOAP sem registros: não publicar como zero')
        const filtered = JSON.parse(renderSpFazendaExpenses(body, query).toString('utf8')) as unknown[]
        evidence = { requestMethod: 'POST', requestParameters: query, originalFormat: 'XML', rawItems: items.length, previewRows: filtered.length, archiveOnly: true }
      } else if (file.layout === 'report') {
        if (file.format !== 'CSV') throw new Error('Formato de relatório não suportado')
        const report = parseFinancialReport(body, 'CSV', 200)
        if (!report.totalRowCount) throw new Error('Relatório sem registros')
        evidence = { requestMethod: 'GET', originalFormat: file.format, reportRows: report.totalRowCount, archiveOnly: true }
      } else {
        if (file.format === 'XML') throw new Error('XML sem adaptador de validação')
        const table = parseSpreadsheet(body, file.format, 200)
        if (!table.totalRowCount) throw new Error('Arquivo sem registros')
        evidence = { requestMethod: 'GET', originalFormat: file.format, columns: table.columns, rows: table.totalRowCount, archiveOnly: true }
      }
      return [] // Preservar o original; não duplicar registros analíticos nesta coleta.
    },
    validate: () => evidence,
  }
}
