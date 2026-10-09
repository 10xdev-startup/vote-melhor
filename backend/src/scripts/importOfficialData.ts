import dotenv from 'dotenv'
import { importOfficialData } from '@/services/importOfficialData'
import { mgRevenueAdapter } from '@/adapters/mgRevenue'
import { createCatalogArchiveAdapters } from '@/adapters/catalogArchive'
import type { OfficialDataAdapter } from '@/types/officialData'
import { OfficialDataModel } from '@/models/OfficialDataModel'
import { camaraArchiveAdapter, senadoArchiveAdapter } from '@/adapters/legislativeArchive'
import { camaraCurrentDeputiesAdapter, senadoCurrentProcessesAdapter } from '@/adapters/legislativeScreenInputs'

dotenv.config({ override: true, quiet: true })

// Registro de adaptadores confiáveis; a CLI não aceita URLs arbitrárias nem roda na API pública.
const catalog = createCatalogArchiveAdapters()
const legislative = [camaraArchiveAdapter, senadoArchiveAdapter]
const screens = [camaraCurrentDeputiesAdapter, senadoCurrentProcessesAdapter]
const adapters: Record<string, OfficialDataAdapter> = Object.fromEntries([mgRevenueAdapter, ...catalog, ...legislative, ...screens].map((adapter) => [adapter.id, adapter]))
const selected = process.argv[2] === 'catalog' ? catalog : process.argv[2] === 'legislative' ? legislative : process.argv[2] === 'legislative-screens' ? screens : adapters[process.argv[2] ?? ''] ? [adapters[process.argv[2]!]!] : []
if (!selected.length) { console.error(`Informe catalog, legislative, legislative-screens ou uma fonte cadastrada: ${Object.keys(adapters).join(', ')}`); process.exitCode = 1 }
else (async () => {
  for (const adapter of selected) {
    await importOfficialData(adapter, console.log, { skipReadyDocuments: process.argv.includes('--resume') })
    const resources: { name: string; active_snapshot_id: string | null; last_check?: Record<string, unknown> }[] = []
    for (let page = 1; ; page++) {
      const result = await OfficialDataModel.listResources(adapter.id, page, 100)
      resources.push(...result.items)
      if (result.items.length < 100) break
    }
    const failed = resources.filter((resource) => resource.last_check?.['result'] === 'failed').map((resource) => resource.name)
    console.log(JSON.stringify({ source: adapter.id, resources: resources.length, available: resources.filter((resource) => resource.active_snapshot_id).length, identifiedOnly: resources.filter((resource) => !resource.active_snapshot_id && resource.last_check?.['result'] === 'identified').length, failed }))
    if (failed.length) process.exitCode = 1
  }
})().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Falha desconhecida'
  console.error(`Importação interrompida: ${message}`)
  if (error instanceof AggregateError) for (const cause of error.errors as unknown[]) {
    const detail = cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String(cause.message) : 'Erro sem mensagem'
    console.error(`Causa: ${detail.slice(0, 1000)}`)
  }
  process.exitCode = 1
})
