import { supabase } from '@/database/supabase'
import { AppError } from '@/utils/AppError'
import { ORIGINAL_MAX_BYTES, sha256, officialErrorMessage } from '@/utils/officialData'
import { gunzipSync } from 'node:zlib'
import type { OfficialRecord } from '@/types/officialData'

const BUCKET = 'official-data'
const MIME_TYPES = ['application/gzip', 'application/json', 'text/csv', 'application/pdf', 'application/zip', 'application/xml']
const RESOURCE_COLUMNS = 'id,source_id,name,title,official_id,url,format,kind,active_snapshot_id,last_check'
const SNAPSHOT_COLUMNS = 'id,resource_id,sha256,schema_sha256,parser_version,schema_document,source_url,fetched_at,published_at,row_count,dependencies,verification,state'

export interface PublicResource {
  id: string; source_id: string; name: string; title: string; official_id: string | null
  url: string; format: string; kind: 'document' | 'dimension' | 'table'; active_snapshot_id: string | null
  last_check?: Record<string, unknown>
}
export interface SnapshotInput {
  resource: PublicResource; body: Buffer; schema: unknown; parserVersion: string; fetchedAt: string; contentType: string; dependencies: Record<string, string>
}
export interface SnapshotResult { id: string; reused: boolean }
export interface SnapshotValidation { rowCount: number; dependencies: Record<string, string>; verification: Record<string, unknown> }
export interface ArchivedDocument { body: Buffer; snapshotId: string; sourceUrl: string; fetchedAt: string; format: string; dependencies: Record<string, string> }
interface SnapshotFile { storage_path: string; storage_bucket: string; sha256: string; verification: Record<string, unknown> }

async function downloadVerifiedOriginal(snapshot: SnapshotFile): Promise<Buffer> {
  const download = await supabase.storage.from(snapshot.storage_bucket).download(snapshot.storage_path)
  if (download.error) throw download.error
  const original = Buffer.from(await download.data.arrayBuffer())
  if (sha256(original) !== snapshot.sha256) throw new AppError(502, 'Original armazenado falhou na verificação de integridade', 'ARCHIVE_HASH_MISMATCH')
  if (snapshot.verification['storageEncoding'] === 'gzip') {
    const decoded = gunzipSync(original, { maxOutputLength: 128 * 1024 * 1024 })
    if (sha256(decoded) !== snapshot.verification['originalSha256'] || decoded.length !== snapshot.verification['originalByteSize']) throw new AppError(502, 'Original descompactado falhou na verificação de integridade', 'ARCHIVE_HASH_MISMATCH')
    return decoded
  }
  return original
}

export const OfficialDataModel = {
  async ensureBucket(): Promise<void> {
    const existing = await supabase.storage.getBucket(BUCKET)
    if (!existing.error) {
      const previousLimit = 6 * 1024 * 1024
      if (existing.data.public || ![previousLimit, ORIGINAL_MAX_BYTES].includes(existing.data.file_size_limit ?? 0)) throw new Error('Bucket official-data diverge do contrato privado/limite de bytes')
      if (!existing.data.allowed_mime_types || existing.data.allowed_mime_types.some((type) => !MIME_TYPES.includes(type))) throw new Error('MIME types do bucket divergem do contrato')
      if (existing.data.file_size_limit !== ORIGINAL_MAX_BYTES || MIME_TYPES.some((type) => !existing.data.allowed_mime_types?.includes(type))) {
        const updated = await supabase.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: ORIGINAL_MAX_BYTES, allowedMimeTypes: MIME_TYPES })
        if (updated.error) throw updated.error
      }
      return
    }
    if (String(existing.error.statusCode) !== '404') throw existing.error
    const created = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: ORIGINAL_MAX_BYTES, allowedMimeTypes: MIME_TYPES })
    if (created.error) throw created.error
  },
  async saveSource(source: { id: string; title: string; organization: string; jurisdiction_code: string; official_url: string; metadata: Record<string, unknown> }): Promise<void> {
    const { error } = await supabase.from('public_data_sources').upsert({ ...source, updated_at: new Date().toISOString() })
    if (error) throw error
  },
  async saveResource(resource: Omit<PublicResource, 'id' | 'active_snapshot_id'>): Promise<PublicResource> {
    const found = await supabase.from('public_data_resources').select(RESOURCE_COLUMNS).eq('source_id', resource.source_id).eq('name', resource.name).maybeSingle()
    if (found.error) throw found.error
    if (found.data && found.data.kind !== resource.kind) throw new Error('Tipo do recurso mudou; revisar adaptador antes de importar')
    const { data, error } = await supabase.from('public_data_resources').upsert({ ...resource, ...(found.data ? { id: found.data.id } : {}) }, { onConflict: 'source_id,name' }).select(RESOURCE_COLUMNS).single()
    if (error) throw error
    return data as PublicResource
  },
  /** Registra descoberta sem apagar versão ativa ou resultado de uma consulta anterior. */
  async registerDiscoveredResources(resources: Omit<PublicResource, 'id' | 'active_snapshot_id'>[]): Promise<void> {
    for (let offset = 0; offset < resources.length; offset += 250) {
      const { error } = await supabase.from('public_data_resources').upsert(resources.slice(offset, offset + 250), { onConflict: 'source_id,name', ignoreDuplicates: true })
      if (error) throw error
    }
  },
  async beginSnapshot(input: SnapshotInput): Promise<SnapshotResult> {
    if (!input.body.length || input.body.length > ORIGINAL_MAX_BYTES) throw new Error('Tamanho do original fora do contrato')
    const hash = sha256(input.body)
    const schemaHash = sha256(JSON.stringify({ schema: input.schema, dependencies: Object.fromEntries(Object.entries(input.dependencies).sort(([left], [right]) => left.localeCompare(right))) }))
    const previous = await supabase.from('public_data_snapshots').select('id').eq('resource_id', input.resource.id).eq('sha256', hash).eq('schema_sha256', schemaHash).eq('parser_version', input.parserVersion).eq('state', 'ready').maybeSingle()
    if (previous.error) throw previous.error
    if (previous.data) return { id: previous.data.id as string, reused: true }
    const extensions: Record<string, string> = { CSV_GZIP: 'csv.gz', JSON_GZIP: 'json.gz', XML_GZIP: 'xml.gz', HTML_GZIP: 'html.gz', JSON: 'json', PDF: 'pdf', ZIP: 'zip', CSV: 'csv', XML: 'xml' }
    const extension = extensions[input.resource.format]
    if (!extension) throw new Error('Formato de original não suportado')
    const path = `${input.resource.source_id}/${input.resource.id}/${hash}/original.${extension}`
    const upload = await supabase.storage.from(BUCKET).upload(path, input.body, { contentType: input.contentType, upsert: false })
    if (upload.error) {
      if (!['409', '400'].includes(String(upload.error.statusCode))) throw upload.error
      // Uma colisão de caminho só é reutilizada depois de conferir o conteúdo existente.
      const original = await supabase.storage.from(BUCKET).download(path)
      if (original.error) throw upload.error
      if (sha256(Buffer.from(await original.data.arrayBuffer())) !== hash) throw new Error('Original armazenado difere do SHA-256 esperado')
    }
    const inserted = await supabase.from('public_data_snapshots').insert({ resource_id: input.resource.id, sha256: hash, schema_sha256: schemaHash, parser_version: input.parserVersion, schema_document: input.schema, storage_bucket: BUCKET, storage_path: path, byte_size: input.body.length, source_url: input.resource.url, fetched_at: input.fetchedAt, dependencies: input.dependencies }).select('id').single()
    if (inserted.error) throw inserted.error
    return { id: inserted.data.id as string, reused: false }
  },
  async writeRows(snapshotId: string, rows: OfficialRecord[]): Promise<void> {
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await supabase.from('public_data_records').insert(rows.slice(offset, offset + 500).map((row) => ({ ...row, snapshot_id: snapshotId })))
      if (error) throw error
    }
  },
  async publishSnapshot(snapshotId: string, validation: SnapshotValidation): Promise<string> {
    const { error } = await supabase.from('public_data_snapshots').update({ row_count: validation.rowCount, dependencies: validation.dependencies, verification: validation.verification }).eq('id', snapshotId).eq('state', 'staging')
    if (error) throw error
    const result = await supabase.rpc('publish_public_data_snapshot', { p_snapshot_id: snapshotId })
    if (result.error) throw result.error
    return result.data as string
  },
  async failSnapshot(snapshotId: string, error: unknown): Promise<void> {
    const message = officialErrorMessage(error)
    const result = await supabase.from('public_data_snapshots').update({ state: 'failed', error: message.slice(0, 1000) }).eq('id', snapshotId).eq('state', 'staging')
    if (result.error) throw result.error
  },
  async recordCheck(resourceId: string, check: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('public_data_resources').update({ last_check: check }).eq('id', resourceId)
    if (error) throw error
  },
  async listSources(page = 1, limit = 50) {
    const offset = (page - 1) * limit
    const { data, error, count } = await supabase.from('public_data_sources').select('id,title,organization,jurisdiction_code,official_url,metadata,updated_at', { count: 'exact' }).order('id').range(offset, offset + limit - 1)
    if (error) throw error
    return { items: data, total: count, page, pageSize: limit }
  },
  async listResources(sourceId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit
    const { data, error, count } = await supabase.from('public_data_resources').select(`${RESOURCE_COLUMNS},attempts:public_data_snapshots!public_data_snapshots_resource_id_fkey(id,state,fetched_at,row_count,error,verification)`, { count: 'exact' }).eq('source_id', sourceId).order('name').order('fetched_at', { referencedTable: 'attempts', ascending: false }).limit(1, { referencedTable: 'attempts' }).range(offset, offset + limit - 1)
    if (error) throw error
    const ids = (data as PublicResource[]).flatMap((resource) => resource.active_snapshot_id ? [resource.active_snapshot_id] : [])
    const snapshots = ids.length ? await supabase.from('public_data_snapshots').select(SNAPSHOT_COLUMNS).in('id', ids).eq('state', 'ready').range(0, 99) : { data: [], error: null }
    if (snapshots.error) throw snapshots.error
    return { items: (data as (PublicResource & { attempts: unknown[] })[]).map(({ attempts, ...resource }) => ({ ...resource, latestAttempt: attempts[0] ?? null, snapshot: snapshots.data?.find((snapshot) => snapshot.id === resource.active_snapshot_id) ?? null })), total: count, page, pageSize: limit }
  },
  async getReadyResource(sourceId: string, name: string): Promise<PublicResource> {
    const { data, error } = await supabase.from('public_data_resources').select(RESOURCE_COLUMNS).eq('source_id', sourceId).eq('name', name).maybeSingle()
    if (error) throw error
    if (!data) throw new AppError(404, 'Recurso não encontrado', 'RESOURCE_NOT_FOUND')
    if (!data.active_snapshot_id) throw new AppError(409, 'Recurso ainda sem versão validada', 'RESOURCE_NOT_READY')
    return data as PublicResource
  },
  async recordsPage(resource: PublicResource, year: number | null, page: number, limit: number) {
    if (resource.kind === 'document') throw new AppError(422, 'Documento disponível como original; sem registros tabulares', 'PREVIEW_NOT_SUPPORTED')
    const { data, error } = await supabase.rpc('read_public_data_page', { p_snapshot_id: resource.active_snapshot_id, p_year: year, p_offset: (page - 1) * limit, p_limit: limit })
    if (error) throw error
    return { snapshotId: resource.active_snapshot_id, page, pageSize: limit, ...data as { total: number; rows: unknown[] } }
  },
  /** Só ausência explícita libera o fallback. Falha de banco/Storage não vira cache miss. */
  async storedOriginal(sourceId: string, name: string): Promise<Buffer | null> {
    const resource = await supabase.from('public_data_resources').select('active_snapshot_id').eq('source_id', sourceId).eq('name', name).maybeSingle()
    if (resource.error) throw resource.error
    if (!resource.data?.active_snapshot_id) return null
    const snapshot = await supabase.from('public_data_snapshots').select('storage_path,storage_bucket,sha256,verification').eq('id', resource.data.active_snapshot_id).eq('state', 'ready').single()
    if (snapshot.error) throw snapshot.error
    return downloadVerifiedOriginal(snapshot.data as SnapshotFile)
  },
  /** URL exata e versão pronta; paginação pode fixar o snapshot declarado pela primeira página. */
  async readArchive(url: string, snapshotId?: string): Promise<ArchivedDocument> {
    if (!snapshotId) {
      const resource = await supabase.from('public_data_resources').select('active_snapshot_id').eq('url', url).not('active_snapshot_id', 'is', null).limit(2)
      if (resource.error) throw resource.error
      if (!resource.data?.length) throw new AppError(503, 'Dados ainda não disponíveis no acervo da Vote Melhor', 'ARCHIVE_RESOURCE_NOT_READY')
      if (resource.data.length !== 1) throw new AppError(503, 'URL vinculada a mais de um recurso ativo; revisar catálogo', 'ARCHIVE_RESOURCE_AMBIGUOUS')
      snapshotId = resource.data[0]!.active_snapshot_id as string
    }
    let query = supabase.from('public_data_snapshots').select('id,source_url,fetched_at,dependencies,verification,storage_path,storage_bucket,sha256').eq('source_url', url).eq('state', 'ready')
    query = query.eq('id', snapshotId)
    const result = await query.order('fetched_at', { ascending: false }).limit(1).maybeSingle()
    if (result.error) throw result.error
    if (!result.data) throw new AppError(503, 'Dados ainda não disponíveis no acervo da Vote Melhor', 'ARCHIVE_RESOURCE_NOT_READY')
    const snapshot = result.data as SnapshotFile & { id: string; source_url: string; fetched_at: string; dependencies: Record<string, string> }
    return { body: await downloadVerifiedOriginal(snapshot), snapshotId: snapshot.id, sourceUrl: snapshot.source_url, fetchedAt: snapshot.fetched_at, format: String(snapshot.verification['originalFormat'] ?? ''), dependencies: snapshot.dependencies }
  },
  async originalUrl(resource: PublicResource): Promise<{ url: string; expiresIn: number; sha256: string; storageEncoding?: string; originalSha256?: string; originalByteSize?: number; originalFormat?: string }> {
    const snapshot = await supabase.from('public_data_snapshots').select('storage_path,sha256,verification').eq('id', resource.active_snapshot_id).eq('state', 'ready').single()
    if (snapshot.error) throw snapshot.error
    const expiresIn = 60
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(snapshot.data.storage_path as string, expiresIn, { download: true })
    if (signed.error) throw signed.error
    const verification = snapshot.data.verification as Record<string, unknown>
    const preservation = verification['storageEncoding'] === 'gzip' ? { storageEncoding: 'gzip', originalSha256: String(verification['originalSha256']), originalByteSize: Number(verification['originalByteSize']), originalFormat: String(verification['originalFormat']) } : {}
    return { url: signed.data.signedUrl, expiresIn, sha256: snapshot.data.sha256 as string, ...preservation }
  },
}
