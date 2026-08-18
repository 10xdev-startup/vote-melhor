/**
 * Como a Vote Melhor classifica o que o Senado registrou na coluna de voto.
 *
 * Sao seis porque colapsar qualquer uma produz numero errado ou injusto na tela:
 *
 * - `secret`: a API devolve `Votou` quando a votacao foi secreta (34,7% de toda a base) e
 *   esse valor nao carrega escolha nenhuma. Contar como voto inflaria o placar.
 * - `not_eligible`: quem nao PODIA votar. O presidente da sessao nao vota (art. 51 RISF,
 *   1.716 ocorrencias) e o impedido esta barrado pelo regimento (art. 306 RISF). Marcar
 *   como ausente seria acusar de faltar quem estava la e cumprindo o rito.
 * - `unclassified`: codigo que a Vote Melhor nao sabe classificar — `MERC`, que o Senado usa mas
 *   nao documenta em tabela nenhuma. Jogar no balaio de ausente seria inventar dado.
 *
 * `secret`, `not_eligible` e `unclassified` ficam FORA do denominador de presenca.
 */
export type { ClassifiedVote, VoteCategory, VoteChoice } from '@/types/vote'

/**
 * Placar de uma votacao nominal.
 *
 * A API devolve `totalVotosSim/Nao/Abstencao` SEMPRE nulos em votacao nominal — os totais so
 * vem preenchidos nas secretas, onde o voto individual nao existe. Entao o placar e
 * calculado, nunca lido.
 */
export interface VotacaoTally {
  yes: number
  no: number
  abstention: number
  obstruction: number
  presentNotVoted: number
  absent: number
  notEligible: number
  secret: number
  unclassified: number
  /** Linhas recebidas. O Senado publica as 81 cadeiras em toda votacao. */
  total: number
}

/**
 * Retrospecto de um parlamentar num conjunto de votacoes.
 *
 * `eligibleCount` e o denominador honesto, e ele varia: quem assumiu como suplente ou entrou
 * no meio do mandato aparece em menos votacoes, e votacao em que a pessoa nao podia votar
 * nao entra na conta. Comparar contagem absoluta entre parlamentares sem esse denominador
 * mente — na legislatura atual os denominadores vao de 556 a 584.
 */
export interface SenatorVotingRecord {
  parliamentarianCode: number
  eligibleCount: number
  votedCount: number
  presentNotVotedCount: number
  absentCount: number
  /** Fracao de `eligibleCount`, de 0 a 1. `null` quando nao houve votacao elegivel. */
  participationRate: number | null
}
