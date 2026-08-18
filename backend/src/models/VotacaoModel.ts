import { classifyResult, classifyVotacaoKind, classifyVote, isContestedVotacao, tallyVotacao, voteMargin } from '@/utils/normalizeSenadoVote'
import { currentYear, fetchNominalVotacoes, RECORD_FROM_YEAR } from '@/utils/fetchSenado'
import { officialMateriaUrl, votacaoId } from '@/utils/senadoIdentifiers'
import type { MateriaGroup, SenadoRawVotacao, VotacaoDetail, VotacaoSenatorVote, VotacaoSummary, VotacoesPayload } from '@/types/senado'

/**
 * Leitura "por pauta" das votacoes nominais — o inverso do `SenatorModel`, sobre o MESMO
 * conjunto carregado por `fetchNominalVotacoes`.
 *
 * A lista e agrupada por materia porque a mesma proposicao volta ao plenario varias vezes,
 * uma por dispositivo (artigo, emenda, substitutivo, turno). Sem agrupar, a `PEC 6/2019`
 * ocupa 11 posicoes com a ementa identica e parece dado duplicado. Agrupada, a repeticao
 * vira informacao: a materia foi fatiada em 11 votacoes.
 */

/** Ordem em que os blocos de voto aparecem: primeiro quem votou, depois quem nao votou. */
const CATEGORY_ORDER: Record<string, number> = {
  voted: 0,
  present_not_voted: 1,
  absent: 2,
  not_eligible: 3,
  secret: 4,
  unclassified: 5,
}

const CHOICE_ORDER: Record<string, number> = { yes: 0, no: 1, abstention: 2, obstruction: 3 }

function toSummary(votacao: SenadoRawVotacao): VotacaoSummary {
  const tally = tallyVotacao(votacao.votos.map((vote) => vote.siglaVotoParlamentar ?? ''))
  return {
    id: votacaoId(votacao),
    date: votacao.dataSessao,
    description: votacao.descricaoVotacao,
    kind: classifyVotacaoKind(votacao.descricaoVotacao),
    result: classifyResult(votacao.resultadoVotacao),
    margin: voteMargin(tally),
    contested: isContestedVotacao(tally),
    tally,
  }
}

/** Mais recente primeiro; dentro do mesmo dia, a votacao mais recente da sessao antes. */
function byMostRecent(a: SenadoRawVotacao, b: SenadoRawVotacao): number {
  const byDate = (b.dataSessao ?? '').localeCompare(a.dataSessao ?? '')
  return byDate !== 0 ? byDate : (b.sequencialVotacao ?? 0) - (a.sequencialVotacao ?? 0)
}

function sortVotes(a: VotacaoSenatorVote, b: VotacaoSenatorVote): number {
  const byCategory = (CATEGORY_ORDER[a.vote.category] ?? 9) - (CATEGORY_ORDER[b.vote.category] ?? 9)
  if (byCategory !== 0) return byCategory

  const byChoice = (CHOICE_ORDER[a.vote.choice ?? ''] ?? 9) - (CHOICE_ORDER[b.vote.choice ?? ''] ?? 9)
  if (byChoice !== 0) return byChoice

  return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
}

/**
 * Agrupa por `identificacao`.
 *
 * Verificado no recorte: nenhuma votacao vem sem identificacao, e a ementa e o
 * `codigoMateria` sao identicos dentro de cada materia — por isso os dois sobem para o
 * grupo. Votacao sem identificacao (defensivo) vira grupo proprio pela `id`, para nao
 * desaparecer da lista nem se misturar com outra materia.
 */
function groupByMateria(votacoes: SenadoRawVotacao[]): MateriaGroup[] {
  const groups = new Map<string, MateriaGroup>()

  for (const votacao of votacoes) {
    const key = votacao.identificacao ?? `sem-identificacao-${votacaoId(votacao)}`
    const summary = toSummary(votacao)
    const group = groups.get(key)

    if (group) {
      group.votacoes.push(summary)
      if (summary.contested) group.contestedCount += 1
      if (summary.kind === 'base_text') group.baseTextResult = summary.result
      continue
    }

    groups.set(key, {
      identification: votacao.identificacao ?? 'Sem identificação',
      summary: votacao.ementa,
      officialUrl: officialMateriaUrl(votacao),
      // As votacoes chegam ja ordenadas da mais recente para a mais antiga, entao a primeira
      // de cada materia e a mais recente.
      lastDate: votacao.dataSessao,
      contestedCount: summary.contested ? 1 : 0,
      baseTextResult: summary.kind === 'base_text' ? summary.result : null,
      votacoes: [summary],
    })
  }

  // Dentro da materia, ordem CRONOLOGICA: o texto-base foi votado antes dos destaques, e ler
  // "aprovada, rejeitada, rejeitada" de tras para frente inverte a historia. Entre materias a
  // ordem segue sendo a mais recente primeiro — la o que importa e o que o Senado fez ontem.
  for (const group of groups.values()) {
    group.votacoes.reverse()
  }

  return [...groups.values()]
}

export const VotacaoModel = {
  /** Matérias votadas, da mais recente para a mais antiga. */
  async listVotacoes(): Promise<VotacoesPayload> {
    const votacoes = [...(await fetchNominalVotacoes())].sort(byMostRecent)
    const materias = groupByMateria(votacoes)

    return {
      collectedAt: new Date().toISOString(),
      coverage: {
        fromYear: RECORD_FROM_YEAR,
        toYear: currentYear(),
        votacaoCount: votacoes.length,
        materiaCount: materias.length,
        contestedCount: materias.reduce((total, materia) => total + materia.contestedCount, 0),
      },
      materias,
    }
  },

  /** Uma pauta com o voto de cada senador. `null` quando o id não existe no recorte. */
  async getVotacao(id: string): Promise<VotacaoDetail | null> {
    const votacoes = await fetchNominalVotacoes()
    const votacao = votacoes.find((item) => votacaoId(item) === id)
    if (!votacao) return null

    const votes: VotacaoSenatorVote[] = votacao.votos
      .filter((vote) => vote.siglaVotoParlamentar !== null)
      .map((vote) => ({
        code: vote.codigoParlamentar,
        name: vote.nomeParlamentar,
        party: vote.siglaPartidoParlamentar,
        state: vote.siglaUFParlamentar,
        vote: classifyVote(vote.siglaVotoParlamentar ?? ''),
      }))

    return {
      ...toSummary(votacao),
      identification: votacao.identificacao,
      summary: votacao.ementa,
      officialUrl: officialMateriaUrl(votacao),
      votes: votes.sort(sortVotes),
    }
  },
}
