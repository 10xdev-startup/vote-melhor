import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { LegislativeJourneyModel } from '@/models/LegislativeJourneyModel'
import { fetchSenadoProcess } from '@/utils/fetchSenado'

jest.mock('@/utils/fetchSenado', () => ({ fetchSenadoProcess: jest.fn() }))

const mockedFetch = fetchSenadoProcess as jest.MockedFunction<typeof fetchSenadoProcess>

beforeEach(() => {
  mockedFetch.mockReset()
  mockedFetch.mockResolvedValue({
    identification: 'PEC 221/2019',
    popularName: 'Fim da escala 6x1',
    matterCode: 174386,
    presentedAt: '2026-05-28',
    status: 'AGUARDANDO DESPACHO',
    statusAt: '2026-05-28',
    sourceUpdatedAt: '2026-07-08T12:27:06.747',
    processing: true,
    objective: 'Revisora',
    documentUrl: 'https://legis.senado.gov.br/documento.pdf',
  })
})

describe('LegislativeJourneyModel.getJourney', () => {
  it('mostra a etapa atual sem confundir regra de quórum com etapa', async () => {
    const journey = await LegislativeJourneyModel.getJourney('scale-6x1')

    expect(mockedFetch).toHaveBeenCalledWith('PEC', 221, 2019)
    expect(journey?.steps.map((step) => [step.id, step.state])).toEqual([
      ['chamber', 'completed'],
      ['senate_committees', 'current'],
      ['senate_first_round', 'pending'],
      ['senate_second_round', 'pending'],
      ['outcome', 'pending'],
    ])
    expect(journey?.quorum).toMatchObject({ required: 49, total: 81, rounds: 2, unit: 'senators' })
    expect(journey?.steps[0]).toMatchObject({
      date: '2026-05-27',
      facts: [
        { label: 'Requerimento', value: '372 sim · 101 não' },
        { label: '1º turno', value: '472 sim · 22 não' },
        { label: '2º turno', value: '461 sim · 19 não' },
      ],
    })
    expect(journey?.steps[1]).toMatchObject({ date: '2026-05-28', detail: 'Aguardando despacho', facts: [{ label: 'Fonte atualizada', value: '2026-07-08T12:27:06.747' }] })
    expect(journey?.steps[2]?.facts[0]).toMatchObject({ label: 'Quórum constitucional', value: '49/81 favoráveis' })
  })

  it('preserva status, frescor, documento e as duas saídas constitucionais', async () => {
    const journey = await LegislativeJourneyModel.getJourney('scale-6x1')

    expect(journey).toMatchObject({ currentStatus: 'AGUARDANDO DESPACHO', currentStatusAt: '2026-05-28', sourceUpdatedAt: '2026-07-08T12:27:06.747' })
    expect(journey?.sourceUrl).toContain('/materia/174386')
    expect(journey?.documentUrl).toContain('senado.gov.br')
    expect(journey?.currentWait).toMatchObject({
      stepId: 'senate_committees',
      since: '2026-05-28',
      nextAction: expect.stringContaining('Publicação e registro'),
      responsible: { name: 'Davi Alcolumbre', party: 'UNIÃO', state: 'AP', role: 'Presidente do Senado' },
      formalReasonPublished: false,
      deadline: { started: false, description: expect.stringContaining('30 dias') },
    })
    expect(journey?.currentWait?.publicContext).toHaveLength(5)
    expect(journey?.currentWait?.publicContext.slice(-2)).toEqual([
      expect.objectContaining({ date: '2026-08-14', description: expect.stringContaining('Davi Alcolumbre') }),
      expect.objectContaining({ date: '2026-08-17', description: expect.stringContaining('ainda não registrava') }),
    ])
    expect(journey?.outcomes).toEqual([
      { condition: 'Se o Senado mantiver o texto', result: 'Promulgação pelas Mesas da Câmara e do Senado' },
      { condition: 'Se o Senado alterar o texto', result: 'Retorno à Câmara dos Deputados' },
    ])
  })

  it('devolve null para jornada não mapeada ou matéria ausente', async () => {
    await expect(LegislativeJourneyModel.getJourney('outra')).resolves.toBeNull()
    mockedFetch.mockResolvedValue(null)
    await expect(LegislativeJourneyModel.getJourney('scale-6x1')).resolves.toBeNull()
  })
})
