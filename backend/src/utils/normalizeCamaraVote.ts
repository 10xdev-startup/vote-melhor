import type { ClassifiedVote, VoteCategory, VoteChoice } from '@/types/vote'
import type { CamaraVotingTally, DeputyVotingRecord } from '@/types/camara'

/**
 * A Câmara e o Senado compartilham as categorias canônicas, não o vocabulário da fonte.
 * Medição completa em `.cursor/plans/fazendo/camara/investigacao-api-votacoes.plan.md`.
 */
interface CamaraVoteCodeEntry {
  category: VoteCategory
  choice: VoteChoice | null
  label: string
}

const VOTE_CODES: Record<string, CamaraVoteCodeEntry> = {
  'Sim': { category: 'voted', choice: 'yes', label: 'Sim' },
  'Não': { category: 'voted', choice: 'no', label: 'Não' },
  'Abstenção': { category: 'voted', choice: 'abstention', label: 'Abstenção' },
  'Obstrução': { category: 'voted', choice: 'obstruction', label: 'Obstrução' },
  // Art. 17, § 1º do RICD: quem preside não vota em Plenário, salvo exceções regimentais.
  'Artigo 17': { category: 'not_eligible', choice: null, label: 'Presidiu a sessão' },
  // Em 2025 a eleição secreta 2576389-4 trouxe 421 linhas com o campo vazio.
  '': { category: 'secret', choice: null, label: 'Votação secreta' },
}

export function classifyCamaraVote(officialCode: string): ClassifiedVote {
  const entry = VOTE_CODES[officialCode]
  if (!entry) {
    return { officialCode, category: 'unclassified', choice: null, label: officialCode, officialLabel: null }
  }
  return {
    officialCode,
    category: entry.category,
    choice: entry.choice,
    label: entry.label,
    officialLabel: null,
  }
}

export function tallyCamaraVotes(officialCodes: readonly string[]): CamaraVotingTally {
  const tally: CamaraVotingTally = {
    yes: 0,
    no: 0,
    abstention: 0,
    obstruction: 0,
    notEligible: 0,
    unclassified: 0,
    totalPublished: officialCodes.length,
  }

  for (const code of officialCodes) {
    const vote = classifyCamaraVote(code)
    if (vote.category === 'voted') {
      if (vote.choice === 'yes') tally.yes += 1
      else if (vote.choice === 'no') tally.no += 1
      else if (vote.choice === 'abstention') tally.abstention += 1
      else tally.obstruction += 1
    } else if (vote.category === 'not_eligible') tally.notEligible += 1
    else if (vote.category === 'unclassified') tally.unclassified += 1
  }

  return tally
}

/** Só Sim e Não medem a distância do empate; as demais posições não apontam um lado. */
export function camaraVoteMargin(tally: CamaraVotingTally): number | null {
  const decisive = tally.yes + tally.no
  if (decisive === 0) return null
  return Math.abs(tally.yes - tally.no) / decisive
}

/** Mesmo critério do Senado: ao menos 20 votos decisivos e diferença menor que 10%. */
export function isContestedCamaraVoting(tally: CamaraVotingTally): boolean {
  const margin = camaraVoteMargin(tally)
  return margin !== null && tally.yes + tally.no >= 20 && margin < 0.1
}

/**
 * O registro mede escolhas publicadas, não presença. A Câmara omite ausentes e por isso não
 * há `eligibleCount` nem taxa de participação neste contrato.
 */
export function buildDeputyRecord(deputyId: number, officialCodes: readonly string[]): DeputyVotingRecord {
  const choices: Record<VoteChoice, number> = { yes: 0, no: 0, abstention: 0, obstruction: 0 }
  let presidedCount = 0

  for (const code of officialCodes) {
    const vote = classifyCamaraVote(code)
    if (vote.category === 'voted' && vote.choice) choices[vote.choice] += 1
    else if (vote.category === 'not_eligible') presidedCount += 1
  }

  return {
    deputyId,
    recordedVoteCount: choices.yes + choices.no + choices.abstention + choices.obstruction,
    presidedCount,
    choices,
  }
}
