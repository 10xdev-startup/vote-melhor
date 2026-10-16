export const CAMARA_CURRENT_DEPUTIES_URL = 'https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&ordem=ASC&ordenarPor=nome'
export function camaraDeputyPageName(page: number): string { return `deputados-em-exercicio-pagina-${page}` }
export function senadoProcessUrl(sigla: string, number: number, year: number): string {
  return `https://legis.senado.leg.br/dadosabertos/processo?${new URLSearchParams({ sigla, numero: String(number), ano: String(year) }).toString()}`
}
