import type { VotacaoTally } from "@/types/senator"
import type { ClassifiedVote } from "@/types/vote"

/** O que o plenário decidiu. `null` quando a fonte não informa (5 de 585 no recorte). */
export type VotacaoResult = "approved" | "rejected" | null

/**
 * Uma votação dentro de uma matéria.
 *
 * Ementa, identificação e link NÃO moram aqui — são da matéria. Repeti-los por votação é o
 * que fazia 11 votações da `PEC 6/2019` parecerem 11 cards duplicados.
 */
/**
 * O que foi posto em votação: a matéria inteira ou um pedaço separado dela.
 *
 * O plenário usa o rito de destaque — aprova o texto todo "ressalvados os destaques" e depois
 * vota cada pedaço à parte. É por isso que uma matéria aparece com uma votação aprovada e
 * duas rejeitadas: não é contradição, são coisas diferentes.
 */
export type VotacaoKind = "base_text" | "highlight" | null

export interface VotacaoSummary {
  id: string
  date: string | null
  /** O que exatamente foi posto em votação (artigo, emenda, substitutivo, turno). */
  description: string | null
  kind: VotacaoKind
  result: VotacaoResult
  /** Distância do empate, de 0 (empate) a 1 (unanimidade). */
  margin: number | null
  /** Decidida no fio — é onde o voto individual de fato pesou. */
  contested: boolean
  tally: VotacaoTally
}

/** Uma matéria e todas as vezes que ela foi ao plenário. */
export interface MateriaGroup {
  identification: string
  summary: string | null
  officialUrl: string | null
  lastDate: string | null
  contestedCount: number
  /**
   * O que aconteceu com o texto da matéria, quando dá para saber — vem da votação de
   * texto-base. `null` nas matérias sem essa votação identificável (49 das 399 têm). Não é
   * inferido da última votação: no recorte, a última é a principal em só 20% dos casos.
   */
  baseTextResult: VotacaoResult
  /** Cronológica CRESCENTE: texto-base antes dos destaques, como aconteceu na sessão. */
  votacoes: VotacaoSummary[]
}

export interface VotacaoSenatorVote {
  code: number | null
  name: string | null
  /** Partido no momento do voto. */
  party: string | null
  state: string | null
  vote: ClassifiedVote
}

export interface VotacaoDetail extends VotacaoSummary {
  identification: string | null
  summary: string | null
  officialUrl: string | null
  votes: VotacaoSenatorVote[]
}

export interface VotacoesPayload {
  collectedAt: string
  coverage: {
    fromYear: number
    toYear: number
    votacaoCount: number
    materiaCount: number
    contestedCount: number
  }
  materias: MateriaGroup[]
}
