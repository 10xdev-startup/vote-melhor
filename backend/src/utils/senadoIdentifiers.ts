import type { SenadoRawVotacao } from '@/types/senado'

/** Pagina publica da materia no site do Senado. */
const MATERIA_URL = 'https://www25.senado.leg.br/web/atividade/materias/-/materia'

/**
 * Identificador estavel de uma votacao.
 *
 * `sequencialVotacao` e unico na serie e e o mesmo numero que o endpoint de orientacao de
 * bancada usa — e o que permite cruzar as duas fontes depois. `codigoSessaoVotacao` fica de
 * reserva para registro antigo que nao traz o sequencial.
 */
export function votacaoId(votacao: SenadoRawVotacao): string {
  return String(votacao.sequencialVotacao ?? votacao.codigoSessaoVotacao ?? '')
}

/** Link oficial da materia votada. `null` quando a votacao nao traz `codigoMateria`. */
export function officialMateriaUrl(votacao: SenadoRawVotacao): string | null {
  return votacao.codigoMateria === null ? null : `${MATERIA_URL}/${votacao.codigoMateria}`
}
