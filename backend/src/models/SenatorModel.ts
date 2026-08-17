import { buildSenatorRecord, classifyVote, tallyVotacao } from '@/utils/normalizeSenadoVote'
import { currentYear, fetchCurrentSenators, fetchNominalVotacoes, RECORD_FROM_YEAR } from '@/utils/fetchSenado'
import { officialMateriaUrl, votacaoId } from '@/utils/senadoIdentifiers'
import type { SenatorDetail, SenatorSummary, SenatorVoteRow, SenatorsPayload } from '@/types/senado'

/**
 * Retrospecto de votacao dos senadores em exercicio — a leitura "por pessoa" do conjunto de
 * votacoes nominais. A leitura "por pauta" do mesmo conjunto vive em `VotacaoModel`.
 */

/** Fim do mandato de quem foi eleito em 2018 — a cadeira volta para a urna em out/2026. */
const BALLOT_MANDATE_END = '2027-01-31'

export const SenatorModel = {
  /** Lista os 81 em exercicio com o retrospecto de cada um. */
  async listSenators(): Promise<SenatorsPayload> {
    const [{ senators, sourceVersion }, votacoes] = await Promise.all([fetchCurrentSenators(), fetchNominalVotacoes()])

    // Uma passada sobre todos os votos, agrupando por parlamentar — evita varrer a lista
    // inteira uma vez por senador.
    const codesByParliamentarian = new Map<number, string[]>()
    for (const votacao of votacoes) {
      for (const vote of votacao.votos) {
        if (vote.codigoParlamentar === null || vote.siglaVotoParlamentar === null) continue
        const bucket = codesByParliamentarian.get(vote.codigoParlamentar)
        if (bucket) bucket.push(vote.siglaVotoParlamentar)
        else codesByParliamentarian.set(vote.codigoParlamentar, [vote.siglaVotoParlamentar])
      }
    }

    const summaries: SenatorSummary[] = senators.map((senator) => ({
      code: senator.code,
      name: senator.name,
      party: senator.party,
      state: senator.state,
      photoUrl: senator.photoUrl,
      officialPageUrl: senator.officialPageUrl,
      onBallot: senator.mandateEndsAt === BALLOT_MANDATE_END,
      record: buildSenatorRecord(senator.code, codesByParliamentarian.get(senator.code) ?? []),
    }))

    return {
      collectedAt: new Date().toISOString(),
      sourceVersion,
      coverage: { fromYear: RECORD_FROM_YEAR, toYear: currentYear(), votacaoCount: votacoes.length },
      senators: summaries,
    }
  },

  /** Retrospecto de um senador com voto a voto. `null` quando o codigo nao esta em exercicio. */
  async getSenator(code: number): Promise<SenatorDetail | null> {
    const [{ senators }, votacoes] = await Promise.all([fetchCurrentSenators(), fetchNominalVotacoes()])
    const senator = senators.find((item) => item.code === code)
    if (!senator) return null

    const rows: SenatorVoteRow[] = []
    const officialCodes: string[] = []

    for (const votacao of votacoes) {
      const vote = votacao.votos.find((item) => item.codigoParlamentar === code)
      if (!vote || vote.siglaVotoParlamentar === null) continue

      officialCodes.push(vote.siglaVotoParlamentar)
      rows.push({
        votacaoId: votacaoId(votacao),
        date: votacao.dataSessao,
        identification: votacao.identificacao,
        summary: votacao.ementa ?? votacao.descricaoVotacao,
        partyAtTime: vote.siglaPartidoParlamentar,
        vote: classifyVote(vote.siglaVotoParlamentar),
        tally: tallyVotacao(votacao.votos.map((item) => item.siglaVotoParlamentar ?? '')),
        officialUrl: officialMateriaUrl(votacao),
      })
    }

    // Mais recente primeiro: e o que o eleitor procura ao abrir a pagina.
    rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

    return {
      code: senator.code,
      name: senator.name,
      party: senator.party,
      state: senator.state,
      photoUrl: senator.photoUrl,
      officialPageUrl: senator.officialPageUrl,
      onBallot: senator.mandateEndsAt === BALLOT_MANDATE_END,
      record: buildSenatorRecord(senator.code, officialCodes),
      votes: rows,
    }
  },
}
