import { officialHttpGet } from '@/utils/officialHttpGet'
import { collectOpenProposals, PNCP_MAX_PAGES, proposalsToRecords, type ProposalArchive } from '@/services/pncpProposals'
import type { ImportResource, OfficialDataAdapter } from '@/types/officialData'

const SOURCE_ID = 'pncp-propostas'
const HOSTS = ['pncp.gov.br']
export const BRAZIL_UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const

export function stateResourceName(uf: string): string {
  return `propostas-${uf.toLowerCase()}`
}

function stateResource(uf: string): ImportResource {
  let archive: ProposalArchive | null = null
  return {
    name: stateResourceName(uf),
    title: `Propostas abertas — ${uf}`,
    official_id: null,
    url: `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?uf=${uf}`,
    format: 'JSON',
    kind: 'table',
    dependencies: [],
    optional: true,
    parserVersion: 'pncp-propostas-v1',
    schema: { purpose: 'open-proposals', uf, modalidade: '', stopped: 'end', pages: 0 },
    async load() {
      console.log(`pncp ${uf}: início`)
      archive = await collectOpenProposals({
        uf,
        modalidade: '',
        maxPages: PNCP_MAX_PAGES,
        onPage: (page, count) => console.log(`pncp ${uf} página ${page}: ${count} contratações`),
        get: async (url) => {
          const response = await officialHttpGet(url, { timeoutMs: 45000, allowedHosts: HOSTS, headers: { Accept: 'application/json' } })
          return { status: response.status, body: response.body }
        },
      })
      console.log(`pncp ${uf}: ${archive.pages.length} páginas, parada ${archive.stopped}`)
      return { body: Buffer.from(JSON.stringify(archive)), fetchedAt: new Date().toISOString() }
    },
    parse(body) {
      archive = JSON.parse(body.toString('utf8')) as ProposalArchive
      const rows = proposalsToRecords(body, archive.modalidade)
      if (!rows.length) throw new Error('Arquivo sem contratações: não publicar como zero')
      return rows
    },
    validate(rows) {
      if (!archive) throw new Error('Coleta ausente')
      const keys = rows.map((row) => row.record_key)
      if (keys.some((key) => !key) || new Set(keys).size !== rows.length) throw new Error('Chave de contratação ausente ou duplicada')
      return { coverageUf: archive.uf, coverageModalidade: archive.modalidade, stopped: archive.stopped, pages: archive.pages.length, proposals: rows.length }
    },
  }
}

export const pncpProposalsAdapter: OfficialDataAdapter = {
  id: SOURCE_ID,
  allowedHosts: HOSTS,
  async discover() {
    return {
      source: {
        id: SOURCE_ID,
        title: 'Contratações com proposta aberta no PNCP',
        organization: 'Portal Nacional de Contratações Públicas',
        jurisdiction_code: 'BR',
        official_url: 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta',
        metadata: {
          concept: 'Lista guardada para a tela de licitações. A visita não consulta o PNCP. Cada estado é uma coleta própria, em sequência.',
          states: [...BRAZIL_UFS],
          retryDelaysMs: [8_000, 20_000, 45_000],
        },
      },
      resources: BRAZIL_UFS.map((uf) => stateResource(uf)),
    }
  },
}
