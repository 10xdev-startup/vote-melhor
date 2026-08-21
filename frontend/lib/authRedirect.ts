// Destino pos-login. So aceita path relativo do proprio app — qualquer outra coisa
// cai no default, senao vira open redirect.
// As rotas do proprio fluxo de entrada tambem sao rejeitadas: mandar o usuario de
// volta pro login, pro cadastro ou pra tela de boas-vindas o devolveria ao comeco.

// Aba padrao pra entrar: o hub que da acesso a Camara, Senado e Fonte de dados.
const DEFAULT_DESTINATION = "/inicio"

// Host fixo so pra resolver o path: se o valor escapar dele, nao era relativo.
const BASE = "https://redirect.invalid"

export function normalizeRedirectTarget(raw: string | string[] | null | undefined): string {
  if (typeof raw !== "string") return DEFAULT_DESTINATION
  // Sem isto, 'evil.com' resolveria pra BASE/evil.com e passaria como se fosse interno.
  if (!raw.startsWith("/")) return DEFAULT_DESTINATION

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return DEFAULT_DESTINATION
  }

  // Resolver com o parser de URL e o que fecha os bypasses: '//evil.com',
  // '/\evil.com' (o parser normaliza a barra invertida) e '/<tab>/evil.com' (o
  // parser remove o caractere de controle) todos acabam com outra origem. E a mesma
  // normalizacao que o browser faria ao seguir o Location.
  if (url.origin !== BASE) return DEFAULT_DESTINATION

  const path = `${url.pathname}${url.search}`

  if (path === "/login" || path.startsWith("/login?")) return DEFAULT_DESTINATION
  if (path === "/cadastro" || path.startsWith("/cadastro?")) return DEFAULT_DESTINATION
  if (path === "/seja-bem-vindo" || path.startsWith("/seja-bem-vindo?")) return DEFAULT_DESTINATION

  return path
}

// Destino de primeiro acesso. O deep link viaja no ?next= porque
// normalizeRedirectTarget rejeita /seja-bem-vindo — passa-la como destino
// devolveria o usuario pra ela depois da CTA.
export function welcomeHref(destination: string): string {
  if (destination === DEFAULT_DESTINATION) return "/seja-bem-vindo"
  return `/seja-bem-vindo?next=${encodeURIComponent(destination)}`
}
