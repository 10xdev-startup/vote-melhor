import type { ClassifiedVote, SenatorVotingRecord, VotacaoTally } from '@/types/senadoVote'

/**
 * O que a API do Senado devolve, antes de qualquer normalizacao.
 *
 * Tudo e anulavel de proposito: o dado historico do Senado tem buraco (UF nula em 83% de
 * 2015, partido `Sem registro` em ate 31% dos anos 90). Tipar como obrigatorio faria o
 * parser mentir sobre a realidade da fonte.
 */
export interface SenadoRawVote {
  codigoParlamentar: number | null
  nomeParlamentar: string | null
  siglaPartidoParlamentar: string | null
  siglaUFParlamentar: string | null
  siglaVotoParlamentar: string | null
}

export interface SenadoRawVotacao {
  codigoSessaoVotacao: number | null
  sequencialVotacao: number | null
  dataSessao: string | null
  identificacao: string | null
  ementa: string | null
  descricaoVotacao: string | null
  codigoMateria: number | null
  votacaoSecreta: string | null
  /** `A` aprovada, `R` rejeitada. Nulo em 5 das 585 votações do recorte. */
  resultadoVotacao: string | null
  votos: SenadoRawVote[]
}

export interface SenadoRawSenator {
  code: number
  name: string
  party: string | null
  state: string | null
  photoUrl: string | null
  officialPageUrl: string | null
  /** Legislatura em que o mandato comecou. 56 = 2019-2027; 57 = 2023-2031. */
  firstLegislature: string | null
  mandateEndsAt: string | null
}

/** Retrospecto de um senador, pronto para a tela. */
export interface SenatorSummary {
  code: number
  name: string
  party: string | null
  state: string | null
  photoUrl: string | null
  officialPageUrl: string | null
  /**
   * `true` quando o mandato termina em 31/01/2027 — ou seja, a cadeira esta na urna em
   * outubro de 2026. Sao 54 das 81.
   */
  onBallot: boolean
  record: SenatorVotingRecord
}

/** Como um senador votou numa votacao especifica. */
export interface SenatorVoteRow {
  votacaoId: string
  date: string | null
  identification: string | null
  summary: string | null
  /** Partido no momento do voto — o Senado guarda a filiacao da epoca, nao a atual. */
  partyAtTime: string | null
  vote: ClassifiedVote
  tally: VotacaoTally
  /** Pagina oficial da materia. `null` quando a votacao nao traz `codigoMateria`. */
  officialUrl: string | null
}

export interface SenatorDetail extends SenatorSummary {
  votes: SenatorVoteRow[]
}

/** O que o plenario decidiu. `null` quando a fonte nao informa (5 de 585 no recorte). */
export type VotacaoResult = 'approved' | 'rejected' | null

/**
 * Uma votacao dentro de uma materia.
 *
 * `identification`, `summary` e `officialUrl` NAO moram aqui: sao da materia, e repeti-los
 * por votacao e o que fazia 11 votacoes da `PEC 6/2019` parecerem 11 cards duplicados.
 */
export interface VotacaoSummary {
  id: string
  date: string | null
  /** O que exatamente foi posto em votacao (artigo, emenda, substitutivo, turno). */
  description: string | null
  /** Materia inteira (`base_text`) ou pedaco destacado (`highlight`). `null` se indefinido. */
  kind: VotacaoKind
  result: VotacaoResult
  /** Distancia do empate, de 0 (empate) a 1 (unanimidade). `null` sem votos sim/nao. */
  margin: number | null
  /** Decidida no fio — e onde o voto individual de fato pesou. */
  contested: boolean
  tally: VotacaoTally
}

/**
 * Uma materia e todas as vezes que ela foi ao plenario.
 *
 * Medido no recorte 2019-2026: 585 votacoes para 399 materias, e a `PEC 6/2019` sozinha tem
 * 11. A ementa e identica em todas as votacoes da mesma materia (verificado: 0 divergencias
 * em 399), entao ela mora aqui — aparece uma vez, e o que diferencia cada votacao e o
 * `description`.
 */
export interface MateriaGroup {
  /** `PL 896/2023`. Chave do agrupamento. */
  identification: string
  /** Ementa — o que a lei faz. */
  summary: string | null
  officialUrl: string | null
  /** Data da votacao mais recente da materia; e o que ordena a lista. */
  lastDate: string | null
  /** Quantas votacoes desta materia foram decididas no fio. */
  contestedCount: number
  /**
   * O que aconteceu com o texto da materia, quando da para saber.
   *
   * Vem da votacao de texto-base — a que decide a materia em si, separada dos destaques.
   * `null` nas materias sem essa votacao identificavel (medido: 49 das 399 tem). NAO e
   * inferido da ultima votacao: no recorte, a ultima e a principal em apenas 20% dos casos.
   */
  baseTextResult: VotacaoResult
  /** Cronologica CRESCENTE: o texto-base vem antes dos destaques, como aconteceu na sessao. */
  votacoes: VotacaoSummary[]
}

/** Como um senador votou numa pauta especifica. */
export interface VotacaoSenatorVote {
  code: number | null
  name: string | null
  /** Partido no momento do voto. */
  party: string | null
  state: string | null
  vote: ClassifiedVote
}

/** A votacao aberta: reune o que e da materia com o voto de cada senador. */
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
    /** 40% das votacoes sao unanimes; estas sao as que separaram o plenario. */
    contestedCount: number
  }
  materias: MateriaGroup[]
}

/**
 * Envelope com procedencia.
 *
 * `collectedAt` e o momento em que o backend leu a fonte, e `sourceVersion` e o carimbo que
 * o proprio Senado publica em `Metadados.Versao`. Sem os dois, a tela nao consegue dizer de
 * quando e o dado que esta mostrando.
 */
export interface SenatorsPayload {
  collectedAt: string
  sourceVersion: string | null
  /** Intervalo de votacoes considerado no retrospecto. */
  coverage: { fromYear: number; toYear: number; votacaoCount: number }
  senators: SenatorSummary[]
}
