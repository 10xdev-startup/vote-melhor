import type { ClassifiedVote, SenatorVotingRecord, VotacaoTally, VoteCategory, VoteChoice } from '@/types/senadoVote'
import type { VotacaoResult } from '@/types/senado'

/**
 * Normalizacao da coluna de voto do Senado.
 *
 * O campo `siglaVotoParlamentar` mistura DOIS dominios: voto (`Sim`, `Nao`...) e
 * comparecimento (`AP`, `LS`...). Na serie de 1991 a 2026 sao 22 valores distintos e so 4
 * sao voto de verdade — 37,8% das 288.774 linhas. Contar linha de `votos[]` como voto
 * produz erro de 62%.
 *
 * `officialLabel` vem da `ListaTiposComparecimento` (versao 14/08/2026), copiado sem editar:
 * https://legis.senado.leg.br/dadosabertos/dados/ListaTiposComparecimento.json
 * Aquela tabela documenta 55 codigos, mas SO os de comparecimento — por isso os codigos de
 * voto e o `MERC` entram aqui com `officialLabel: null`.
 *
 * Ver `.cursor/plans/fazendo/senado/investigacao-api-votacoes.plan.md` para as medicoes.
 */

interface VoteCodeEntry {
  category: VoteCategory
  choice: VoteChoice | null
  /** Rotulo curto da 10xGov. O texto oficial longo nao cabe na linha da tabela. */
  label: string
  officialLabel: string | null
}

const VOTE_CODES: Record<string, VoteCodeEntry> = {
  // --- Voto: conteudo conhecido. Nao constam da tabela oficial de comparecimento.
  'Sim': { category: 'voted', choice: 'yes', label: 'Sim', officialLabel: null },
  'Não': { category: 'voted', choice: 'no', label: 'Não', officialLabel: null },
  'Abstenção': { category: 'voted', choice: 'abstention', label: 'Abstenção', officialLabel: null },
  'Obstrução': { category: 'voted', choice: 'obstruction', label: 'Obstrução', officialLabel: null },
  // O presidente da sessao vota quando o art. 48, XXIII do RISF permite. Duas ocorrencias
  // na serie inteira, mas sao voto e contam no placar.
  'Sim - Presidente Art.48 inciso XXIII': { category: 'voted', choice: 'yes', label: 'Sim (presidente)', officialLabel: null },
  'Não - Presidente Art.48 inciso XXIII': { category: 'voted', choice: 'no', label: 'Não (presidente)', officialLabel: null },

  // --- Esteve presente e nao votou. Nao e falta.
  'P-NRV': { category: 'present_not_voted', choice: null, label: 'Presente, não votou', officialLabel: 'Presente – Não registrou voto' },
  'P-OD': { category: 'present_not_voted', choice: null, label: 'Obstrução declarada', officialLabel: 'Presente – Obstrução Declarada' },

  // --- Ausencia, com o motivo que o Senado registrou.
  'AP': { category: 'absent', choice: null, label: 'Atividade parlamentar', officialLabel: 'Atividade parlamentar' },
  'LS': { category: 'absent', choice: null, label: 'Licença saúde', officialLabel: 'Licença saúde' },
  'NCom': { category: 'absent', choice: null, label: 'Não compareceu', officialLabel: 'Não Compareceu' },
  'MIS': { category: 'absent', choice: null, label: 'Missão da Casa', officialLabel: 'Missão da Casa no País/exterior' },
  'LP': { category: 'absent', choice: null, label: 'Licença particular', officialLabel: 'Licença Particular' },
  'REP': { category: 'absent', choice: null, label: 'Representação em solenidade', officialLabel: 'Representação em solenidade internac./nac./reg.' },
  'LG': { category: 'absent', choice: null, label: 'Licença gestante', officialLabel: 'Licença à gestante' },
  'LA': { category: 'absent', choice: null, label: 'Licença adotante', officialLabel: 'Licença à adotante' },
  'LAP': { category: 'absent', choice: null, label: 'Licença paternidade', officialLabel: 'Licença paternidade ou ao adotante' },

  // --- Nao podia votar. Contar como falta seria acusar quem cumpria o rito.
  'Presidente (art. 51 RISF)': { category: 'not_eligible', choice: null, label: 'Presidiu a sessão', officialLabel: null },
  'Impedido (art.306 RISF)': { category: 'not_eligible', choice: null, label: 'Impedido pelo regimento', officialLabel: null },
  'NA': { category: 'not_eligible', choice: null, label: 'Dispositivo não citado', officialLabel: 'Dispositivo não citado' },

  // --- Votacao secreta: houve voto, o conteudo nao e publico.
  'Votou': { category: 'secret', choice: null, label: 'Votou (secreta)', officialLabel: null },
}

/**
 * Classifica uma sigla de voto.
 *
 * Codigo desconhecido volta como `unclassified` com o proprio codigo no `label` — a 10xGov
 * mostra exatamente o que o Senado publicou em vez de adivinhar uma categoria. `MERC` (5
 * ocorrencias na serie) cai aqui.
 */
export function classifyVote(officialCode: string): ClassifiedVote {
  const entry = VOTE_CODES[officialCode]
  if (!entry) {
    return { officialCode, category: 'unclassified', choice: null, label: officialCode, officialLabel: null }
  }
  return {
    officialCode,
    category: entry.category,
    choice: entry.choice,
    label: entry.label,
    officialLabel: entry.officialLabel,
  }
}

/** Calcula o placar de uma votacao nominal a partir das siglas publicadas. */
export function tallyVotacao(officialCodes: readonly string[]): VotacaoTally {
  const tally: VotacaoTally = {
    yes: 0,
    no: 0,
    abstention: 0,
    obstruction: 0,
    presentNotVoted: 0,
    absent: 0,
    notEligible: 0,
    secret: 0,
    unclassified: 0,
    total: officialCodes.length,
  }

  for (const code of officialCodes) {
    const { category, choice } = classifyVote(code)
    if (category === 'voted') {
      if (choice === 'yes') tally.yes += 1
      else if (choice === 'no') tally.no += 1
      else if (choice === 'abstention') tally.abstention += 1
      else tally.obstruction += 1
    } else if (category === 'present_not_voted') tally.presentNotVoted += 1
    else if (category === 'absent') tally.absent += 1
    else if (category === 'not_eligible') tally.notEligible += 1
    else if (category === 'secret') tally.secret += 1
    else tally.unclassified += 1
  }

  return tally
}

/**
 * O que foi posto em votacao: a materia inteira ou um pedaco separado dela.
 *
 * O plenario usa o rito de destaque: aprova o texto todo "ressalvados os destaques" e depois
 * vota cada pedaco separado. E por isso que a `PLP 18/2021` aparece com uma votacao aprovada
 * e duas rejeitadas — nao e contradicao, sao coisas diferentes.
 *
 * `null` quando a descricao nao permite dizer. Sao 400 das 585 votacoes, e a maioria vota a
 * materia inteira sem sub-dispositivo — mas rotular por eliminacao seria chute.
 */
export type VotacaoKind = 'base_text' | 'highlight' | null

/**
 * Sem normalizar acento de proposito: os termos que decidem (`ressalvado`, `destaque`,
 * `destacad`) nao tem acento em nenhuma flexao, entao `toLowerCase()` basta e o arquivo fica
 * livre da regex de combining marks.
 */
export function classifyVotacaoKind(description: string | null): VotacaoKind {
  if (!description) return null
  const text = description.toLowerCase()
  if (text.includes('ressalvado') && text.includes('destaque')) return 'base_text'
  if (text.includes('destacad') || text.includes('destaque')) return 'highlight'
  return null
}

/** `A` aprovada, `R` rejeitada. Qualquer outra coisa vira `null` em vez de virar chute. */
export function classifyResult(raw: string | null): VotacaoResult {
  if (raw === 'A') return 'approved'
  if (raw === 'R') return 'rejected'
  return null
}

/**
 * Distancia do empate: 0 significa empate tecnico, 1 significa unanimidade.
 *
 * So `Sim` e `Não` entram na conta. Abstencao, obstrucao e ausencia nao empurram o resultado
 * para nenhum lado — inclui-las diluiria a margem e faria votacao apertada parecer folgada.
 */
export function voteMargin(tally: VotacaoTally): number | null {
  const decisive = tally.yes + tally.no
  if (decisive === 0) return null
  return Math.abs(tally.yes - tally.no) / decisive
}

/** Piso de votos para a margem significar algo: 3 a 2 nao e votacao disputada, e quorum baixo. */
const CONTESTED_MIN_VOTES = 20
/** Ate 10% de diferenca, uma dezena de senadores mudaria o resultado. */
const CONTESTED_MAX_MARGIN = 0.1

/**
 * Votacao decidida no fio.
 *
 * No recorte 2019-2026, 40% das votacoes sao unanimes e nao diferenciam ninguem. As 27 que
 * passam neste teste sao onde o voto individual de fato pesou — entre elas o IBS da reforma
 * tributaria, rejeitado por 33 a 32.
 */
export function isContestedVotacao(tally: VotacaoTally): boolean {
  const margin = voteMargin(tally)
  if (margin === null) return false
  return tally.yes + tally.no >= CONTESTED_MIN_VOTES && margin < CONTESTED_MAX_MARGIN
}

/**
 * Monta o retrospecto de um parlamentar.
 *
 * `officialCodes` sao as siglas daquele parlamentar nas votacoes em que ele aparece — o
 * denominador ja nasce individual. Votacao em que nao podia votar, secreta ou nao
 * classificada fica de fora de `eligibleCount`: entrar no denominador derrubaria o
 * percentual de quem presidiu a sessao.
 */
export function buildSenatorRecord(parliamentarianCode: number, officialCodes: readonly string[]): SenatorVotingRecord {
  let votedCount = 0
  let presentNotVotedCount = 0
  let absentCount = 0

  for (const code of officialCodes) {
    const { category } = classifyVote(code)
    if (category === 'voted') votedCount += 1
    else if (category === 'present_not_voted') presentNotVotedCount += 1
    else if (category === 'absent') absentCount += 1
  }

  const eligibleCount = votedCount + presentNotVotedCount + absentCount

  return {
    parliamentarianCode,
    eligibleCount,
    votedCount,
    presentNotVotedCount,
    absentCount,
    participationRate: eligibleCount === 0 ? null : votedCount / eligibleCount,
  }
}
