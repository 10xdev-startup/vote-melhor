import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { clearSpFazendaExpensesCache, fetchSpFazendaExpenses, parseSpFazendaExpensesXml } from '@/utils/fetchSpFazendaExpenses'

const XML = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ConsultarDespesasDotacaoResponse xmlns="http://fazenda.sp.gov.br/wstransparencia"><ConsultarDespesasDotacaoResult><CodigoRetorno>0</CodigoRetorno><DescricaoCodigoRetorno>3 item(ns) retornado(s).</DescricaoCodigoRetorno><ListaItensDespesa><ItemDespesa><CodigoNomeOrgao>16000 - SECRETARIA DA SAUDE</CodigoNomeOrgao><CodigoNomeElemento>449051 - OBRAS E INSTALACOES</CodigoNomeElemento><ValorDotacaoInicial>1.000,00</ValorDotacaoInicial><ValorDotacaoAtual>2.000,00</ValorDotacaoAtual><ValorEmpenhado>1.500,00</ValorEmpenhado><ValorLiquidado>1.200,00</ValorLiquidado><ValorPago>1.100,00</ValorPago><ValorPagoAnosAnteriores>100,00</ValorPagoAnosAnteriores></ItemDespesa><ItemDespesa><CodigoNomeOrgao>37000 - SECRETARIA DE TRANSPORTES</CodigoNomeOrgao><CodigoNomeElemento>459065 - CONSTITUICAO DE CAPITAL</CodigoNomeElemento><ValorDotacaoInicial>3.000,00</ValorDotacaoInicial><ValorDotacaoAtual>4.000,00</ValorDotacaoAtual><ValorEmpenhado>3.500,00</ValorEmpenhado><ValorLiquidado>3.200,00</ValorLiquidado><ValorPago>3.100,00</ValorPago><ValorPagoAnosAnteriores>200,00</ValorPagoAnosAnteriores></ItemDespesa><ItemDespesa><CodigoNomeOrgao>08000 - SECRETARIA DA EDUCACAO</CodigoNomeOrgao><CodigoNomeElemento>339039 - SERVICOS DE TERCEIROS</CodigoNomeElemento><ValorDotacaoInicial>5.000,00</ValorDotacaoInicial></ItemDespesa></ListaItensDespesa></ConsultarDespesasDotacaoResult></ConsultarDespesasDotacaoResponse></soap:Body></soap:Envelope>`

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  clearSpFazendaExpensesCache()
})

describe('fetchSpFazendaExpenses', () => {
  it('lê todos os itens do XML SOAP preservando os valores como texto', () => {
    const items = parseSpFazendaExpensesXml(XML)
    expect(items).toHaveLength(3)
    expect(items[0]?.ValorEmpenhado).toBe('1.500,00')
  })

  it('seleciona naturezas 44/45 e reutiliza o XML bruto do exercício', async () => {
    const mockedFetch = jest.fn(async () => new Response(XML, { status: 200, headers: { 'Content-Type': 'text/xml' } }))
    global.fetch = mockedFetch as typeof fetch

    const investments = JSON.parse((await fetchSpFazendaExpenses({ type: 'sp-fazenda-expenses', year: 2024, naturePrefixes: ['44'] })).toString()) as Array<Record<string, string>>
    const inversions = JSON.parse((await fetchSpFazendaExpenses({ type: 'sp-fazenda-expenses', year: 2024, naturePrefixes: ['45'] })).toString()) as Array<Record<string, string>>

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(investments).toHaveLength(1)
    expect(investments[0]?.['Grupo da despesa']).toBe('Investimentos')
    expect(investments[0]?.['Valor empenhado']).toBe('1.500,00')
    expect(inversions).toHaveLength(1)
    expect(inversions[0]?.['Grupo da despesa']).toBe('Inversões financeiras')
  })

  it('rejeita erro declarado pelo serviço mesmo quando o HTTP é 200', () => {
    const failedXml = XML.replace('<CodigoRetorno>0</CodigoRetorno>', '<CodigoRetorno>-30</CodigoRetorno>').replace('3 item(ns) retornado(s).', 'Parâmetros inválidos')
    expect(() => parseSpFazendaExpensesXml(failedXml)).toThrow('A Fazenda recusou a consulta')
  })
})
