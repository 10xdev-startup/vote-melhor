import { archiveFile } from '@/adapters/legislativeArchive'
import { LegislativeJourneyModel } from '@/models/LegislativeJourneyModel'
import { CAMARA_CURRENT_DEPUTIES_URL, camaraDeputyPageName, senadoProcessUrl } from '@/utils/legislativeArchiveRequests'
import type { ImportResource, OfficialDataAdapter } from '@/types/officialData'

export const camaraCurrentDeputiesAdapter: OfficialDataAdapter = {
  id: 'camara-current-deputies', allowedHosts: ['dadosabertos.camara.leg.br'],
  async discover(collect) {
    const pages: ImportResource[] = []; const visited = new Set<string>(); const deputies = new Set<number>()
    let url: string | null = CAMARA_CURRENT_DEPUTIES_URL
    while (url) {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'dadosabertos.camara.leg.br' || parsed.pathname !== '/api/v2/deputados' || visited.has(url) || visited.size >= 20) throw new Error('Paginação oficial de deputados inválida')
      visited.add(url)
      const collected = await collect(url)
      const payload = JSON.parse(collected.body.toString('utf8')) as { dados?: { id: number; nome: string }[]; links?: { rel: string; href: string }[] }
      if (!Array.isArray(payload.dados) || !payload.dados.length || !Array.isArray(payload.links)) throw new Error('Página de deputados vazia ou inválida')
      for (const deputy of payload.dados) {
        if (!Number.isSafeInteger(deputy.id) || !deputy.nome || deputies.has(deputy.id)) throw new Error('Cadastro de deputados tem identidade inválida ou duplicada')
        deputies.add(deputy.id)
      }
      pages.push({ ...archiveFile({ name: camaraDeputyPageName(pages.length + 1), title: `Deputados em exercício: página ${pages.length + 1}`, url, format: 'JSON', period: null, catalogUrl: 'https://dadosabertos.camara.leg.br/swagger/api.html', selected: true, reason: 'Lista paginada usada pelas telas atuais; distinta do cadastro histórico' }), collected, optional: false })
      url = payload.links.find((link) => link.rel === 'next')?.href ?? null
    }
    const first = pages[0]!
    first.dependencies = pages.slice(1).map((page) => page.name)
    first.schema = { ...first.schema as Record<string, unknown>, pageCount: pages.length, deputyCount: deputies.size, pinnedPageResources: first.dependencies }
    return { source: { id: this.id, title: 'Câmara: deputados em exercício', organization: 'Câmara dos Deputados', jurisdiction_code: 'BR', official_url: 'https://dadosabertos.camara.leg.br/api/v2/deputados', metadata: { archiveOnly: true, pageCount: pages.length, deputyCount: deputies.size, completePagination: true, rootPublishedLast: true } }, resources: [...pages.slice(1), first] }
  },
}

export const senadoCurrentProcessesAdapter: OfficialDataAdapter = {
  id: 'senado-current-processes', allowedHosts: ['legis.senado.leg.br', 'legis.senado.gov.br'],
  async discover() {
    const resources = LegislativeJourneyModel.listProcessRequests().map((request) => ({ ...archiveFile({ name: `processo-${request.sigla}-${request.number}-${request.year}`, title: `Tramitação: ${request.sigla} ${request.number}/${request.year}`, url: senadoProcessUrl(request.sigla, request.number, request.year), format: 'JSON', period: String(request.year), catalogUrl: 'https://www12.senado.leg.br/dados-abertos', selected: true, reason: `Consulta da trilha legislativa ${request.id}, derivada da configuração existente` }), optional: false }))
    return { source: { id: this.id, title: 'Senado: tramitações usadas pela plataforma', organization: 'Senado Federal', jurisdiction_code: 'BR', official_url: 'https://legis.senado.leg.br/dadosabertos/processo', metadata: { archiveOnly: true, curatedBy: 'LegislativeJourneyModel', requestCount: resources.length } }, resources }
  },
}
