import type { PublicResource } from '@/models/OfficialDataModel'

export interface CollectedData { body: Buffer; fetchedAt: string }
export type OfficialCollector = (url: string) => Promise<CollectedData>
export interface OfficialRecord { row_number: number; reference_year: number | null; record_key: string | null; payload: Record<string, unknown> }
export interface OfficialSource { id: string; title: string; organization: string; jurisdiction_code: string; official_url: string; metadata: Record<string, unknown> }
export interface ImportResource extends Omit<PublicResource, 'id' | 'active_snapshot_id' | 'source_id'> {
  schema: unknown
  parserVersion: string
  dependencies: string[]
  optionalDependencies?: string[]
  optional?: boolean
  collected?: CollectedData
  load?: (collect: OfficialCollector) => Promise<CollectedData>
  storageEncoding?: 'gzip'
  maxDownloadBytes?: number
  parse?: (body: Buffer) => OfficialRecord[]
  validate?: (rows: OfficialRecord[], context: Map<string, OfficialRecord[]>) => Record<string, unknown>
}
export interface OfficialDataAdapter {
  id: string
  allowedHosts: readonly string[]
  discover: (collect: OfficialCollector) => Promise<{ source: OfficialSource; resources: ImportResource[]; catalog?: ImportResource[] }>
}
