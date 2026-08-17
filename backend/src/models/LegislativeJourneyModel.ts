import { fetchSenadoProcess } from '@/utils/fetchSenado'
import type { SenadoRawProcess } from '@/types/senado'
import type { LegislativeJourney, LegislativeJourneyStep, LegislativeJourneyStepId } from '@/types/legislativeJourney'

const SENATE_TOTAL_SEATS = 81
const PEC_REQUIRED_VOTES = 49
const PEC_ROUNDS = 2
const CONSTITUTION_ARTICLE_60_URL = 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#art60'
const CAMARA_VOTING_URL = 'https://dadosabertos.camara.leg.br/api/v2/votacoes'
const SENATE_RULES_URL = 'https://www2.senado.leg.br/bdsf/bitstream/handle/id/650284/Regimento_interno_Senado_Federal_2023_v.1.pdf'
const SENATE_PRESIDENT_PROFILE_URL = 'https://www12.senado.leg.br/institucional/presidencia/perfil-do-presidente'
const SCALE_NEWS_URLS = {
  commissions: 'https://www12.senado.leg.br/noticias/materias/2026/06/02/pec-da-escala-6x1-nao-ira-diretamente-para-o-plenario-do-senado-diz-davi',
  publicDebate: 'https://www12.senado.leg.br/noticias/materias/2026/07/01/senado-promove-amplo-debate-sobre-fim-da-escala-de-trabalho-6x1',
  electionCalendar: 'https://www12.senado.leg.br/noticias/materias/2026/07/28/discussao-sobre-fim-da-escala-de-trabalho-6x1-continua-em-agosto',
  forwardingAnnouncement: 'https://www12.senado.leg.br/noticias/materias/2026/08/14/davi-divulga-prioridades-da-pauta-incluindo-fim-da-escala-6-x-1',
} as const

interface JourneyConfig {
  sigla: string
  number: number
  year: number
}

const JOURNEYS: Record<string, JourneyConfig> = {
  'scale-6x1': { sigla: 'PEC', number: 221, year: 2019 },
}

function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase('pt-BR')
  return `${lower.charAt(0).toLocaleUpperCase('pt-BR')}${lower.slice(1)}`
}

function currentStepIndex(process: SenadoRawProcess): number | null {
  if (process.processing === false) return 4
  const status = process.status ?? ''
  if (status.includes('APROVAD') && status.includes('SEGUNDO TURNO')) return 4
  if (status.includes('SEGUNDO TURNO') || (status.includes('APROVAD') && status.includes('PRIMEIRO TURNO'))) return 3
  if (status.includes('PRIMEIRO TURNO') || status.includes('PLENÁRIO')) return 2
  if (status.includes('DESPACHO') || status.includes('COMISS') || status.includes('RELATOR')) return 1
  return null
}

function buildSteps(process: SenadoRawProcess): LegislativeJourneyStep[] {
  const current = currentStepIndex(process)
  const steps: Omit<LegislativeJourneyStep, 'state'>[] = [
    {
      id: 'chamber',
      label: 'Câmara',
      detail: 'Aprovada em dois turnos',
      date: '2026-05-27',
      facts: [
        { label: 'Requerimento', value: '372 sim · 101 não', kind: 'text', sourceUrl: `${CAMARA_VOTING_URL}/2233802-416` },
        { label: '1º turno', value: '472 sim · 22 não', kind: 'text', sourceUrl: `${CAMARA_VOTING_URL}/2233802-424` },
        { label: '2º turno', value: '461 sim · 19 não', kind: 'text', sourceUrl: `${CAMARA_VOTING_URL}/2233802-438` },
      ],
    },
    {
      id: 'senate_committees',
      label: 'Comissões do Senado',
      detail: process.status ? sentenceCase(process.status) : 'Despacho e análise pelas comissões do Senado',
      date: process.presentedAt,
      facts: process.sourceUpdatedAt
        ? [{ label: 'Fonte atualizada', value: process.sourceUpdatedAt, kind: 'date', sourceUrl: null }]
        : [],
    },
    { id: 'senate_first_round', label: '1º turno no Senado', detail: 'Exige 49/81 senadores favoráveis', date: null, facts: [{ label: 'Quórum constitucional', value: '49/81 favoráveis', kind: 'text', sourceUrl: CONSTITUTION_ARTICLE_60_URL }] },
    { id: 'senate_second_round', label: '2º turno no Senado', detail: 'Exige novamente 49/81 senadores favoráveis', date: null, facts: [{ label: 'Quórum constitucional', value: '49/81 favoráveis', kind: 'text', sourceUrl: CONSTITUTION_ARTICLE_60_URL }] },
    { id: 'outcome', label: 'Desfecho', detail: 'Promulgação ou retorno à Câmara', date: null, facts: [] },
  ]
  return steps.map((step, index) => ({
    ...step,
    state: index === 0 || (current !== null && index < current) ? 'completed' : index === current ? 'current' : 'pending',
  }))
}

export const LegislativeJourneyModel = {
  async getJourney(id: string): Promise<LegislativeJourney | null> {
    const config = JOURNEYS[id]
    if (!config) return null
    const process = await fetchSenadoProcess(config.sigla, config.number, config.year)
    if (!process) return null
    const sourceUrl = `https://www25.senado.leg.br/web/atividade/materias/-/materia/${process.matterCode}`
    const awaitingDispatch = Boolean(process.status?.includes('AGUARDANDO DESPACHO') && process.statusAt)

    return {
      id,
      identification: process.identification,
      popularName: process.popularName,
      currentHouse: 'senate',
      currentStatus: process.status,
      currentStatusAt: process.statusAt,
      sourceUpdatedAt: process.sourceUpdatedAt,
      collectedAt: new Date().toISOString(),
      processing: process.processing,
      sourceUrl,
      documentUrl: process.documentUrl,
      currentWait: awaitingDispatch && process.statusAt
        ? {
            stepId: 'senate_committees',
            since: process.statusAt,
            nextAction: 'Publicação e registro do despacho às comissões. O encaminhamento foi anunciado',
            responsible: {
              name: 'Davi Alcolumbre',
              party: 'UNIÃO',
              state: 'AP',
              role: 'Presidente do Senado',
              sourceUrl: SENATE_PRESIDENT_PROFILE_URL,
            },
            formalReasonPublished: false,
            processSourceUrl: sourceUrl,
            deadline: {
              description: 'A CCJ terá até 30 dias para emitir parecer, contados do despacho da Presidência',
              started: false,
              sourceUrl: SENATE_RULES_URL,
            },
            publicContext: [
              {
                date: '2026-06-02',
                description: 'A Presidência informou que a PEC passaria pelas comissões para ampliar a discussão antes do Plenário.',
                sourceUrl: SCALE_NEWS_URLS.commissions,
              },
              {
                date: '2026-07-01',
                description: 'O Senado realizou uma sessão temática com sindicatos, empregadores, especialistas e representantes do governo.',
                sourceUrl: SCALE_NEWS_URLS.publicDebate,
              },
              {
                date: '2026-07-28',
                description: 'Governo e senadores favoráveis pressionavam por votação em agosto; representantes empresariais defendiam análise após as eleições.',
                sourceUrl: SCALE_NEWS_URLS.electionCalendar,
              },
              {
                date: '2026-08-14',
                description: 'Após reunião com Lula, Davi Alcolumbre informou que determinou o encaminhamento da PEC às comissões competentes.',
                sourceUrl: SCALE_NEWS_URLS.forwardingAnnouncement,
              },
              {
                date: '2026-08-17',
                description: 'O processo oficial ainda não registrava o despacho anunciado e permanecia com a situação “Aguardando despacho”.',
                sourceUrl,
              },
            ],
          }
        : null,
      quorum: {
        required: PEC_REQUIRED_VOTES,
        total: SENATE_TOTAL_SEATS,
        rounds: PEC_ROUNDS,
        unit: 'senators',
        sourceUrl: CONSTITUTION_ARTICLE_60_URL,
      },
      steps: buildSteps(process),
      outcomes: [
        { condition: 'Se o Senado mantiver o texto', result: 'Promulgação pelas Mesas da Câmara e do Senado' },
        { condition: 'Se o Senado alterar o texto', result: 'Retorno à Câmara dos Deputados' },
      ],
    }
  },
}
