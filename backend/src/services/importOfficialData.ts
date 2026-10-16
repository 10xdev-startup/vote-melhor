import { OfficialDataModel, type PublicResource, type SnapshotResult } from '@/models/OfficialDataModel'
import { officialHttpGet } from '@/utils/officialHttpGet'
import { ORIGINAL_MAX_BYTES, sha256, officialErrorMessage } from '@/utils/officialData'
import { gzipSync } from 'node:zlib'
import type { OfficialDataAdapter, OfficialRecord } from '@/types/officialData'

class CollectionError extends Error {
  constructor(readonly status: number) { super(`Origem oficial respondeu HTTP ${status}`) }
}

/** Pipeline compartilhado. O adaptador descobre recursos e define validações do domínio. */
export async function importOfficialData(adapter: OfficialDataAdapter, log: (message: string) => void = console.log, options: { skipReadyDocuments?: boolean } = {}): Promise<void> {
  const collect = async (url: string, maxBytes = ORIGINAL_MAX_BYTES, json = false) => {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 128 * 1024 * 1024) throw new Error('Limite de coleta fora do contrato')
    const response = await officialHttpGet(url, { timeoutMs: 120000, maxBytes, allowedHosts: adapter.allowedHosts, ...(json ? { headers: { Accept: 'application/json' } } : {}) })
    if (response.status !== 200) throw new CollectionError(response.status)
    return { body: response.body, fetchedAt: new Date().toISOString() }
  }
  const plan = await adapter.discover(collect)
  if (plan.source.id !== adapter.id) throw new Error('Adaptador diverge da fonte descoberta')
  await OfficialDataModel.ensureBucket()
  await OfficialDataModel.saveSource(plan.source)
  if (plan.catalog) await OfficialDataModel.registerDiscoveredResources(plan.catalog.map((spec) => ({ source_id: adapter.id, name: spec.name, title: spec.title, official_id: spec.official_id, url: spec.url, format: spec.format, kind: spec.kind, last_check: { result: 'identified', checkedAt: new Date().toISOString(), documentation: spec.schema } })))
  const versions = new Map<string, string>()
  const context = new Map<string, OfficialRecord[]>()
  const existing = new Map<string, PublicResource>()
  if (options.skipReadyDocuments) for (let page = 1; ; page++) {
    const result = await OfficialDataModel.listResources(adapter.id, page, 100)
    for (const resource of result.items) existing.set(resource.name, resource)
    if (result.items.length < 100) break
  }
  for (const spec of plan.resources) {
    const previous = existing.get(spec.name)
    if (options.skipReadyDocuments && spec.kind === 'document' && !spec.collected && previous?.active_snapshot_id && previous.url === spec.url && previous.last_check?.['result'] !== 'failed') {
      versions.set(spec.name, previous.active_snapshot_id)
      context.set(spec.name, [])
      log(`${spec.name}: original já disponível; sem nova consulta à origem`)
      continue
    }
    const dependencies: Record<string, string> = {}
    for (const name of spec.dependencies) {
      const id = versions.get(name)
      if (!id) throw new Error(`Dependência ${name} precisa ser importada antes de ${spec.name}`)
      dependencies[name] = id
    }
    for (const name of spec.optionalDependencies ?? []) {
      const id = versions.get(name)
      if (id) dependencies[name] = id
    }
    let snapshot: SnapshotResult | null = null
    let resource: PublicResource | null = null
    let httpStatus: number | null = null
    try {
      const format = spec.storageEncoding === 'gzip' ? `${spec.format}_GZIP` : spec.format
      resource = await OfficialDataModel.saveResource({ source_id: adapter.id, name: spec.name, title: spec.title, official_id: spec.official_id, url: spec.url, format, kind: spec.kind })
      const collected = spec.collected ?? (spec.load ? await spec.load(collect) : await collect(resource.url, spec.maxDownloadBytes, spec.format === 'JSON'))
      httpStatus = 200
      const contentType = spec.storageEncoding === 'gzip' || spec.format === 'CSV_GZIP' ? 'application/gzip' : spec.format === 'PDF' ? 'application/pdf' : spec.format === 'ZIP' ? 'application/zip' : spec.format === 'CSV' ? 'text/csv' : spec.format === 'XML' ? 'application/xml' : 'application/json'
      const storedBody = spec.storageEncoding === 'gzip' ? gzipSync(collected.body, { level: 9 }) : collected.body
      const preservation = spec.storageEncoding === 'gzip' ? { storageEncoding: 'gzip', originalFormat: spec.format, originalSha256: sha256(collected.body), originalByteSize: collected.body.length } : {}
      const schema = spec.storageEncoding === 'gzip' ? { sourceSchema: spec.schema, storageEncoding: 'gzip', originalFormat: spec.format } : spec.schema
      snapshot = await OfficialDataModel.beginSnapshot({ resource, body: storedBody, fetchedAt: collected.fetchedAt, schema, parserVersion: spec.parserVersion, contentType, dependencies })
      const rows = spec.parse ? spec.parse(collected.body) : []
      if (spec.kind !== 'document' && !rows.length) throw new Error('Arquivo sem registros: não publicar como zero')
      const verification = { ...preservation, ...spec.validate?.(rows, context) }
      if (snapshot.reused) { versions.set(spec.name, snapshot.id); log(`${spec.name}: versão existente reutilizada`) }
      else {
        if (rows.length) await OfficialDataModel.writeRows(snapshot.id, rows)
        const id = await OfficialDataModel.publishSnapshot(snapshot.id, { rowCount: rows.length, dependencies, verification: { httpStatus: 200, ...verification } })
        versions.set(spec.name, id)
        log(spec.kind === 'document' ? `${spec.name}: original preservado` : `${spec.name}: ${rows.length} registros validados`)
      }
      context.set(spec.name, rows)
      await OfficialDataModel.recordCheck(resource.id, { checkedAt: new Date().toISOString(), httpStatus, result: spec.kind === 'document' ? 'access_tested' : 'data_consulted', snapshotId: versions.get(spec.name), verification })
    } catch (error) {
      if (snapshot && !snapshot.reused) {
        try { await OfficialDataModel.failSnapshot(snapshot.id, error) } catch (recordError) { throw new AggregateError([error, recordError], 'Importação falhou e o registro da falha também falhou', { cause: recordError }) }
      }
      if (resource) {
        try { await OfficialDataModel.recordCheck(resource.id, { checkedAt: new Date().toISOString(), httpStatus: error instanceof CollectionError ? error.status : httpStatus, result: 'failed', message: officialErrorMessage(error) }) }
        catch (recordError) { throw new AggregateError([error, recordError], 'Falha ao registrar a verificação do recurso', { cause: recordError }) }
      }
      if (!spec.optional) throw error
      const message = officialErrorMessage(error)
      log(`${spec.name}: pendente (${message})`)
    }
  }
}
