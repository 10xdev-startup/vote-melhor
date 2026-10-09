import { parseOfficialCsv, type OfficialRow, type OfficialSchema } from '@/utils/officialData'
import { normalizeRevenueRow, PARSER_VERSION, REVENUE_FIELDS, validateDimensionLinks } from '@/adapters/mgRevenueValidation'
import type { ImportResource, OfficialDataAdapter, OfficialRecord } from '@/types/officialData'

const SOURCE_ID = 'mg-revenue'
const PACKAGE_URL = 'https://dados.mg.gov.br/api/3/action/package_show?id=receita'
interface CkanResource { id: string; name: string; url: string }
interface PackageResource { name: string; title: string; schema: OfficialSchema }

/** As regras de receita de MG são locais a este adaptador; a infraestrutura é compartilhada. */
export const mgRevenueAdapter: OfficialDataAdapter = {
  id: SOURCE_ID,
  allowedHosts: ['dados.mg.gov.br'],
  async discover(collect) {
    const catalog = await collect(PACKAGE_URL)
    const envelope = JSON.parse(catalog.body.toString('utf8')) as { success: boolean; result: { id: string; metadata_modified: string; resources: CkanResource[] } }
    if (!envelope.success || !Array.isArray(envelope.result?.resources)) throw new Error('Metadados CKAN inválidos')
    const packageResource = envelope.result.resources.find((resource) => resource.url.endsWith('/datapackage.json'))
    if (!packageResource) throw new Error('Datapackage não localizado')
    const datapackage = await collect(packageResource.url)
    const definition = JSON.parse(datapackage.body.toString('utf8')) as { resources: PackageResource[] }
    const fact = definition.resources.find((resource) => resource.name === 'ft_receita_v2018')
    if (!fact || JSON.stringify(fact.schema.fields.map((field) => field.name)) !== JSON.stringify(REVENUE_FIELDS) || !fact.schema.foreignKeys?.length) throw new Error('Contrato de receita v2018 mudou; revisar adaptador')
    const documents: ImportResource[] = [
      { name: 'ckan-metadata', title: 'Metadados oficiais CKAN', url: PACKAGE_URL, official_id: null, format: 'JSON', kind: 'document', schema: { type: 'official-metadata', name: 'ckan-metadata' }, parserVersion: 'raw-json-v1', dependencies: [], collected: catalog, validate: () => ({ jsonParsed: true }) },
      { name: 'datapackage', title: 'Dicionário oficial e relacionamentos', url: packageResource.url, official_id: packageResource.id, format: 'JSON', kind: 'document', schema: { type: 'official-metadata', name: 'datapackage' }, parserVersion: 'raw-json-v1', dependencies: [], collected: datapackage, validate: () => ({ jsonParsed: true }) },
    ]
    function resource(spec: PackageResource, kind: ImportResource['kind']): ImportResource {
      const official = envelope.result.resources.find((item) => new URL(item.url).pathname.endsWith(`/${spec.name}.csv.gz`))
      if (!official) throw new Error(`Recurso oficial ${spec.name} não localizado`)
      return { name: spec.name, title: spec.title, official_id: official.id, url: official.url, format: 'CSV_GZIP', kind, schema: spec.schema, parserVersion: PARSER_VERSION, dependencies: ['datapackage'] }
    }
    const dimensions: ImportResource[] = []
    for (const name of new Set(fact.schema.foreignKeys.map((link) => link.reference.resource))) {
      const spec = definition.resources.find((item) => item.name === name)
      if (!spec || spec.schema.primaryKey?.length !== 1) throw new Error(`Contrato de dimensão não suportado: ${name}`)
      const key = spec.schema.primaryKey[0]!
      dimensions.push({ ...resource(spec, 'dimension'), optional: true, parse: (body) => parseOfficialCsv(body, spec.schema).map((payload, index) => ({ row_number: index + 1, reference_year: /^\d{4}$/.test(payload['ano'] ?? '') ? Number(payload['ano']) : null, record_key: payload[key] ?? null, payload })), validate: (rows) => {
        const keys = rows.map((row) => row.record_key)
        if (keys.some((value) => !value) || new Set(keys).size !== rows.length) throw new Error(`Chave ausente ou duplicada: ${name}`)
        return { headerMatchesSchema: true, uniqueKeys: true }
      } })
    }
    const revenue: ImportResource = { ...resource(fact, 'table'), dependencies: documents.map((item) => item.name), optionalDependencies: dimensions.map((item) => item.name), parse: (body) => parseOfficialCsv(body, fact.schema).map((row, index) => {
      const normalized = normalizeRevenueRow(row, index + 1)
      return { row_number: index + 1, reference_year: normalized.year, record_key: null, payload: { ...row, vr_efetivado: normalized.amount } }
    }), validate: (rows: OfficialRecord[], context) => {
      const values = new Map<string, OfficialRow[]>([...context].map(([name, records]) => [name, records.map((row) => row.payload as OfficialRow)]))
      const dimensionLinks = fact.schema.foreignKeys!.map((link) => {
        try { validateDimensionLinks(rows.map((row) => row.payload as OfficialRow), [link], values); return { resource: link.reference.resource, status: 'validated' } }
        catch (error) { return { resource: link.reference.resource, status: 'pending', reason: error instanceof Error ? error.message : 'Não validado' } }
      })
      return { headerMatchesSchema: true, dimensionLinksValidated: dimensionLinks.every((link) => link.status === 'validated'), dimensionLinks, decimalExact: true, years: [...new Set(rows.map((row) => row.reference_year))].sort(), currentYearIsPartial: true, reconciliationStatus: 'pending', usage: 'Registros oficiais preservados; não produzir classificações/indicadores sem reconciliar as dimensões pendentes.' }
    } }
    return { source: { id: SOURCE_ID, title: 'Receita pública de Minas Gerais', organization: 'Controladoria-Geral do Estado de Minas Gerais', jurisdiction_code: '31', official_url: 'https://dados.mg.gov.br/dataset/receita', metadata: { ckanPackageId: envelope.result.id, officialMetadataModified: envelope.result.metadata_modified, updateFrequencyDeclared: 'Diária', unit: 'BRL', concept: 'Receita orçamentária efetivada ajustada; não é PIB nem receita prevista.', coverage: 'Série v2018; exercício corrente parcial.', unresolved: 'Reconciliar com RREO/DCA antes de publicar indicadores anuais.' } }, resources: [...documents, ...dimensions, revenue] }
  },
}
