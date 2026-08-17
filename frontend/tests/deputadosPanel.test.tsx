import { beforeEach, describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { CamaraView } from '@/app/(dashboard)/camara/CamaraView'
import { camaraVotingService } from '@/services/camaraVotingService'
import { deputyService } from '@/services/deputyService'
import { legislativeJourneyService } from '@/services/legislativeJourneyService'
import type { CamaraVotingDetail, CamaraVotingsPayload } from '@/types/camaraVoting'
import type { DeputiesPayload, DeputyDetail } from '@/types/deputy'
import type { LegislativeJourney } from '@/types/legislativeJourney'

type MockFn<T> = {
  (...args: never[]): unknown
  mockReset: () => void
  mockResolvedValue: (value: T) => void
}

declare const jest: {
  mock: (moduleName: string, factory: () => unknown) => void
  fn: () => MockFn<never>
}

jest.mock('@/services/deputyService', () => ({
  deputyService: { getDeputies: jest.fn(), getDeputy: jest.fn() },
}))

jest.mock('@/services/camaraVotingService', () => ({
  camaraVotingService: { getVotings: jest.fn(), getVoting: jest.fn() },
}))

jest.mock('@/services/legislativeJourneyService', () => ({
  legislativeJourneyService: { getJourney: jest.fn() },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/camara',
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const getDeputies = deputyService.getDeputies as unknown as MockFn<DeputiesPayload>
const getDeputy = deputyService.getDeputy as unknown as MockFn<DeputyDetail>
const getVotings = camaraVotingService.getVotings as unknown as MockFn<CamaraVotingsPayload>
const getVoting = camaraVotingService.getVoting as unknown as MockFn<CamaraVotingDetail>
const getJourney = legislativeJourneyService.getJourney as unknown as MockFn<LegislativeJourney>

const PAYLOAD: DeputiesPayload = {
  collectedAt: '2026-08-17T01:00:00.000Z',
  sourceUpdatedAt: '2026-08-16T06:57:59.000Z',
  sourceUrls: ['https://dadosabertos.camara.leg.br/api/v2/deputados'],
  coverage: { year: 2026, lastDate: '2026-08-13', votingCount: 120 },
  deputies: [
    {
      id: 209787,
      name: 'Nikolas Ferreira',
      party: 'PL',
      state: 'MG',
      photoUrl: 'https://www.camara.leg.br/nikolas.jpg',
      apiUrl: 'https://dadosabertos.camara.leg.br/api/v2/deputados/209787',
      officialPageUrl: 'https://www.camara.leg.br/deputados/209787',
      record: { deputyId: 209787, recordedVoteCount: 99, presidedCount: 0, choices: { yes: 70, no: 27, abstention: 1, obstruction: 1 } },
    },
    {
      id: 1,
      name: 'Ana Deputada',
      party: 'PT',
      state: 'SP',
      photoUrl: null,
      apiUrl: null,
      officialPageUrl: 'https://www.camara.leg.br/deputados/1',
      record: { deputyId: 1, recordedVoteCount: 80, presidedCount: 1, choices: { yes: 50, no: 30, abstention: 0, obstruction: 0 } },
    },
  ],
}

const DETAIL: DeputyDetail = {
  ...PAYLOAD.deputies[0]!,
  votes: [
    {
      votingId: '2422887-23',
      date: '2026-05-19',
      description: 'Rejeitado o Requerimento. Sim: 126; Não: 274.',
      partyAtTime: 'PL',
      vote: { officialCode: 'Não', category: 'voted', choice: 'no', label: 'Não', officialLabel: null },
      tally: { yes: 126, no: 274, abstention: 2, obstruction: 0, notEligible: 1, unclassified: 0, totalPublished: 403 },
      result: 'rejected',
      officialUrl: 'https://dadosabertos.camara.leg.br/api/v2/votacoes/2422887-23',
      propositions: [
        { id: 2190986, title: 'PL 364/2019', summary: 'Protege vegetação nativa.', apiUrl: null, officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/2190986' },
        { id: 2422887, title: 'REC 5/2024', summary: 'Recurso sobre o projeto.', apiUrl: null, officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/2422887' },
      ],
    },
  ],
}

const VOTINGS_PAYLOAD: CamaraVotingsPayload = {
  collectedAt: '2026-08-17T01:00:00.000Z',
  sourceUpdatedAt: '2026-08-16T06:57:59.000Z',
  sourceUrls: ['https://dadosabertos.camara.leg.br/arquivos/votacoes/json/votacoes-2026.json'],
  coverage: { year: 2026, lastDate: '2026-08-12', votingCount: 120, propositionCount: 89, relationCount: 132, contestedCount: 3, contestedPropositionCount: 1 },
  propositions: [
    {
      proposition: { id: 10, title: 'PL 2/2026', summary: 'Amplia o atendimento de saúde pública', apiUrl: 'https://api/proposicoes/10', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/10' },
      authors: [{ name: 'Reginaldo Lopes', party: 'PT', state: 'MG', sourceUrl: 'https://www.camara.leg.br/propostas-legislativas/2233802' }],
      popularNames: [{ label: 'Escala 6x1', sourceUrl: 'https://www.camara.leg.br/noticias/1277141-camara-aprova-em-dois-turnos-fim-da-escala-6x1-com-jornada-maxima-de-40-horas-semanais' }],
      journeyId: 'scale-6x1',
      lastDate: '2026-08-12',
      contestedCount: 1,
      votings: [
        {
          id: 'v1',
          date: '2026-08-11',
          description: 'Votação apertada',
          result: null,
          margin: 0.04,
          contested: true,
          tally: { yes: 52, no: 48, abstention: 0, obstruction: 0, notEligible: 0, unclassified: 0, totalPublished: 100 },
          officialUrl: 'https://api/votacoes/v1',
        },
        {
          id: 'v2',
          date: '2026-08-12',
          description: 'Votação do substitutivo',
          result: null,
          margin: 0.37,
          contested: false,
          tally: { yes: 126, no: 274, abstention: 2, obstruction: 0, notEligible: 1, unclassified: 0, totalPublished: 403 },
          officialUrl: 'https://api/votacoes/v2',
        },
      ],
    },
    {
      proposition: { id: 11, title: 'REQ 1/2026', summary: 'Requerimento relacionado', apiUrl: 'https://api/proposicoes/11', officialPageUrl: 'https://www.camara.leg.br/propostas-legislativas/11' },
      authors: [],
      popularNames: [],
      journeyId: null,
      lastDate: '2026-08-12',
      contestedCount: 0,
      votings: [
        {
          id: 'v2',
          date: '2026-08-12',
          description: 'Votação do substitutivo',
          result: null,
          margin: 0.37,
          contested: false,
          tally: { yes: 126, no: 274, abstention: 2, obstruction: 0, notEligible: 1, unclassified: 0, totalPublished: 403 },
          officialUrl: 'https://api/votacoes/v2',
        },
      ],
    },
  ],
}

const VOTING_DETAIL: CamaraVotingDetail = {
  ...VOTINGS_PAYLOAD.propositions[0]!.votings[1]!,
  propositions: VOTINGS_PAYLOAD.propositions.map((group) => group.proposition!),
  votes: [
    { deputyId: 209787, name: 'Nikolas Ferreira', party: 'PL', state: 'MG', vote: { officialCode: 'Não', category: 'voted', choice: 'no', label: 'Não', officialLabel: null } },
    { deputyId: 1, name: 'Ana Deputada', party: 'PT', state: 'SP', vote: { officialCode: 'Sim', category: 'voted', choice: 'yes', label: 'Sim', officialLabel: null } },
  ],
}

const JOURNEY: LegislativeJourney = {
  id: 'scale-6x1',
  identification: 'PEC 221/2019',
  popularName: 'Fim da escala 6x1',
  currentHouse: 'senate',
  currentStatus: 'AGUARDANDO DESPACHO',
  currentStatusAt: '2026-05-28',
  sourceUpdatedAt: '2026-07-08T12:27:06.747',
  collectedAt: '2026-08-17T03:00:00.000Z',
  processing: true,
  sourceUrl: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/174386',
  documentUrl: 'https://legis.senado.gov.br/documento.pdf',
  currentWait: {
    stepId: 'senate_committees',
    since: '2026-05-28',
    nextAction: 'Publicação e registro do despacho às comissões. O encaminhamento foi anunciado',
    responsible: {
      name: 'Davi Alcolumbre',
      party: 'UNIÃO',
      state: 'AP',
      role: 'Presidente do Senado',
      sourceUrl: 'https://www12.senado.leg.br/institucional/presidencia/perfil-do-presidente',
    },
    formalReasonPublished: false,
    processSourceUrl: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/174386',
    deadline: {
      description: 'A CCJ terá até 30 dias para emitir parecer, contados do despacho da Presidência',
      started: false,
      sourceUrl: 'https://www2.senado.leg.br/regimento.pdf',
    },
    publicContext: [
      { date: '2026-06-02', description: 'A Presidência informou que a PEC passaria pelas comissões para ampliar a discussão antes do Plenário.', sourceUrl: 'https://www12.senado.leg.br/noticias/1' },
      { date: '2026-07-01', description: 'O Senado realizou uma sessão temática com sindicatos, empregadores, especialistas e representantes do governo.', sourceUrl: 'https://www12.senado.leg.br/noticias/2' },
      { date: '2026-07-28', description: 'Governo e senadores favoráveis pressionavam por votação em agosto; representantes empresariais defendiam análise após as eleições.', sourceUrl: 'https://www12.senado.leg.br/noticias/3' },
      { date: '2026-08-14', description: 'Após reunião com Lula, Davi Alcolumbre informou que determinou o encaminhamento da PEC às comissões competentes.', sourceUrl: 'https://www12.senado.leg.br/noticias/4' },
      { date: '2026-08-17', description: 'O processo oficial ainda não registrava o despacho anunciado e permanecia com a situação “Aguardando despacho”.', sourceUrl: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/174386' },
    ],
  },
  quorum: { required: 49, total: 81, rounds: 2, unit: 'senators', sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#art60' },
  steps: [
    { id: 'chamber', label: 'Câmara', detail: 'Aprovada em dois turnos', date: '2026-05-27', facts: [
      { label: 'Requerimento', value: '372 sim · 101 não', kind: 'text', sourceUrl: 'https://api/votacoes/requerimento' },
      { label: '1º turno', value: '472 sim · 22 não', kind: 'text', sourceUrl: 'https://api/votacoes/primeiro-turno' },
      { label: '2º turno', value: '461 sim · 19 não', kind: 'text', sourceUrl: 'https://api/votacoes/segundo-turno' },
    ], state: 'completed' },
    { id: 'senate_committees', label: 'Comissões do Senado', detail: 'Aguardando despacho', date: '2026-05-28', facts: [{ label: 'Fonte atualizada', value: '2026-07-08T12:27:06.747', kind: 'date', sourceUrl: null }], state: 'current' },
    { id: 'senate_first_round', label: '1º turno no Senado', detail: 'Exige 49/81 senadores favoráveis', date: null, facts: [{ label: 'Quórum constitucional', value: '49/81 favoráveis', kind: 'text', sourceUrl: 'https://www.planalto.gov.br/constituicao#art60' }], state: 'pending' },
    { id: 'senate_second_round', label: '2º turno no Senado', detail: 'Exige novamente 49/81 senadores favoráveis', date: null, facts: [{ label: 'Quórum constitucional', value: '49/81 favoráveis', kind: 'text', sourceUrl: 'https://www.planalto.gov.br/constituicao#art60' }], state: 'pending' },
    { id: 'outcome', label: 'Desfecho', detail: 'Promulgação ou retorno à Câmara', date: null, facts: [], state: 'pending' },
  ],
  outcomes: [
    { condition: 'Se o Senado mantiver o texto', result: 'Promulgação pelas Mesas da Câmara e do Senado' },
    { condition: 'Se o Senado alterar o texto', result: 'Retorno à Câmara dos Deputados' },
  ],
}

beforeEach(() => {
  window.history.replaceState({}, '', '/camara')
  getDeputies.mockReset()
  getDeputy.mockReset()
  getVotings.mockReset()
  getVoting.mockReset()
  getJourney.mockReset()
  getDeputies.mockResolvedValue(PAYLOAD)
  getDeputy.mockResolvedValue(DETAIL)
  getVotings.mockResolvedValue(VOTINGS_PAYLOAD)
  getVoting.mockResolvedValue(VOTING_DETAIL)
  getJourney.mockResolvedValue(JOURNEY)
})

describe('CamaraView', () => {
  it('mostra o recorte e os deputados em exercício sem taxa de participação', async () => {
    render(<CamaraView />)

    expect(await screen.findByText('Nikolas Ferreira')).toBeInTheDocument()
    expect(screen.getByText(/2 deputados em exercício · 120 votações nominais/)).toBeInTheDocument()
    expect(screen.getByLabelText('99 votos publicados').parentElement).toHaveTextContent('99 votos publicados · 70 sim · 27 não · 2 outros')
    expect(screen.queryByText(/taxa de participação:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ ausentes/i)).not.toBeInTheDocument()
  })

  it('busca por nome, partido ou estado', async () => {
    render(<CamaraView />)
    await screen.findByText('Nikolas Ferreira')

    fireEvent.change(screen.getByLabelText('Buscar deputado'), { target: { value: 'SP' } })

    expect(screen.getByText('Ana Deputada')).toBeInTheDocument()
    expect(screen.queryByText('Nikolas Ferreira')).not.toBeInTheDocument()
  })

  it('filtra por partido sem ordenar por critério editorial', async () => {
    render(<CamaraView />)
    await screen.findByText('Nikolas Ferreira')

    fireEvent.click(screen.getByRole('button', { name: 'PT 1' }))

    expect(screen.getByText('Ana Deputada')).toBeInTheDocument()
    expect(screen.queryByText('Nikolas Ferreira')).not.toBeInTheDocument()
  })

  it('cruza estado e partido nas contagens sem ocultar opções zeradas', async () => {
    render(<CamaraView />)
    await screen.findByText('Nikolas Ferreira')

    expect(screen.getByRole('group', { name: 'Filtrar deputados por estado' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'MG 1' }))

    expect(screen.getByText('Nikolas Ferreira')).toBeInTheDocument()
    expect(screen.queryByText('Ana Deputada')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PL 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PT 0' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'PT 0' }))
    expect(screen.getByRole('button', { name: 'MG 0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SP 1' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum deputado encontrado para esse filtro.')).toBeInTheDocument()
  })

  it('abre o voto a voto e preserva todas as proposições afetadas', async () => {
    render(<CamaraView />)
    const name = await screen.findByText('Nikolas Ferreira')
    fireEvent.click(name.closest('button')!)

    expect(await screen.findByText('PL 364/2019')).toBeInTheDocument()
    expect(screen.getByText('REC 5/2024')).toBeInTheDocument()
    expect(screen.getByText(/Placar publicado: 126 sim · 274 não/)).toBeInTheDocument()
    expect(getDeputy).toHaveBeenCalledWith(209787)
  })

  it('oferece a aba Pautas e explica relações com mais de uma proposição', async () => {
    render(<CamaraView />)

    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))

    expect(await screen.findByText(/89 proposições em 120 votações nominais/)).toBeInTheDocument()
    expect(screen.getByText(/São 132 relações/)).toBeInTheDocument()
    expect(screen.getByText('PL 2/2026')).toBeInTheDocument()
    expect(screen.getByText('REQ 1/2026')).toBeInTheDocument()
  })

  it('filtra pautas pelas mesmas tags temáticas do Senado', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))
    await screen.findByText('PL 2/2026')
    expect(screen.queryByRole('button', { name: 'Previdência e aposentadoria 0' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Saúde 1' }))

    expect(screen.getByText('PL 2/2026')).toBeInTheDocument()
    expect(screen.queryByText('REQ 1/2026')).not.toBeInTheDocument()
  })

  it('mostra o nome popular com fonte oficial e permite buscar por ele', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))

    const popularName = await screen.findByRole('link', { name: 'Escala 6x1 — nome usado pela Câmara' })
    expect(popularName).toHaveAttribute('href', expect.stringContaining('camara.leg.br/noticias/'))
    expect(screen.getByRole('link', { name: /Reginaldo Lopes \(PT-MG\)/ })).toHaveAttribute('href', expect.stringContaining('camara.leg.br/propostas-legislativas/'))

    fireEvent.change(screen.getByLabelText('Buscar pauta da Câmara'), { target: { value: '6x1' } })
    expect(screen.getByText('PL 2/2026')).toBeInTheDocument()
    expect(screen.queryByText('REQ 1/2026')).not.toBeInTheDocument()
  })

  it('mostra a espera documentada dentro da etapa atual e integra quórum e desfechos à linha do tempo', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))

    expect(await screen.findByText(/Senado · Aguardando despacho há 81 dias/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Tramitação' }))

    expect(screen.queryByText('Quórum no Senado')).not.toBeInTheDocument()
    expect(screen.getAllByText('49/81 favoráveis')).toHaveLength(2)
    expect(screen.getByLabelText('Etapas da tramitação')).toHaveClass('flex', 'flex-col')
    const chamberStep = screen.getByText('Câmara').closest('li')
    expect(chamberStep).toHaveTextContent('27/05/2026')
    expect(chamberStep).toHaveTextContent(/372 sim · 101 não/)
    expect(chamberStep).toHaveTextContent(/472 sim · 22 não/)
    expect(chamberStep).toHaveTextContent(/461 sim · 19 não/)
    const senateCommitteeStep = screen.getByText('Comissões do Senado').closest('li')
    expect(senateCommitteeStep).toHaveTextContent(/desde 28\/05\/2026/)
    expect(senateCommitteeStep).toHaveTextContent(/Aguardando despacho/)
    expect(senateCommitteeStep).toHaveTextContent(/Fonte atualizada08\/07\/2026/)
    expect(senateCommitteeStep).toHaveTextContent(/O que falta agora/)
    expect(senateCommitteeStep).toHaveTextContent(/Davi Alcolumbre \(UNIÃO-AP\)/)
    expect(screen.getByRole('link', { name: /Davi Alcolumbre \(UNIÃO-AP\)/ })).toHaveAttribute('href', JOURNEY.currentWait?.responsible.sourceUrl)
    expect(senateCommitteeStep).toHaveTextContent(/O prazo ainda não começou/)
    const waitExplanation = screen.getByText('Entenda por que ainda não avançou').closest('details')
    expect(waitExplanation).toHaveAttribute('open')
    expect(screen.getByText(/Não há justificativa formal publicada/)).toBeInTheDocument()
    expect(screen.getByText('Contexto público documentado')).toBeInTheDocument()
    expect(screen.getByText(/Davi Alcolumbre informou que determinou o encaminhamento/)).toBeInTheDocument()
    expect(screen.getByText(/processo oficial ainda não registrava o despacho anunciado/)).toBeInTheDocument()
    expect(screen.getAllByText('Sem data publicada')).toHaveLength(3)
    expect(screen.getByText('Se o Senado mantiver o texto')).toBeInTheDocument()
    expect(screen.getByText('Se o Senado alterar o texto')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tramitação oficial/i })).toHaveAttribute('href', JOURNEY.sourceUrl)
    expect(screen.getByText(/Fonte atualizada em 08\/07\/2026/)).toBeInTheDocument()
    expect(getJourney).toHaveBeenCalledWith('scale-6x1')
  })

  it('mantém uma proposição por linha mesmo em telas largas', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))

    const proposition = await screen.findByText('PL 2/2026')
    expect(proposition.closest('article')?.parentElement).toHaveClass('grid-cols-1')
    expect(proposition.closest('article')?.parentElement).not.toHaveClass('xl:grid-cols-2')
  })

  it('mostra somente pautas com votação decidida no fio quando o filtro está ativo', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))
    await screen.findByText('REQ 1/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Só as decididas no fio (1)' }))

    expect(screen.getByText('PL 2/2026')).toBeInTheDocument()
    expect(screen.queryByText('REQ 1/2026')).not.toBeInTheDocument()
    expect(screen.getByText(/menos de 10% de diferença entre Sim e Não/)).toBeInTheDocument()
  })

  it('abre uma pauta com todas as posições publicadas e sem inferir ausentes', async () => {
    render(<CamaraView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pautas' }))
    const rows = await screen.findAllByText('Votação do substitutivo')
    fireEvent.click(rows[0]!.closest('button')!)

    expect(await screen.findByText('Nikolas Ferreira')).toBeInTheDocument()
    expect(screen.getByText(/403 posições publicadas/)).toBeInTheDocument()
    for (const list of screen.getAllByRole('list')) {
      expect(list).toHaveClass('grid', 'md:grid-cols-2', 'lg:grid-cols-3', '2xl:grid-cols-4')
    }
    expect(screen.queryByText(/\d+ ausentes/i)).not.toBeInTheDocument()
    expect(getVoting).toHaveBeenCalledWith('v2')
  })
})
