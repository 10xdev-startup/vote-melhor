// Destino pos-login. So aceita path relativo do proprio app — qualquer outra coisa
// cai no fallback, senao vira open redirect.
// As rotas do proprio fluxo de entrada tambem sao rejeitadas: mandar o usuario de
// volta pro login, pro cadastro ou pra tela de boas-vindas o devolveria ao comeco.

// Primeira tela do produto. `/inicio` era a vitrine do template e saiu da sidebar.
const FALLBACK = "/camara"

// Host fixo so pra resolver o path: se o valor escapar dele, nao era relativo.
const BASE = "https://redirect.invalid"

export function normalizeRedirectTarget(raw: string | string[] | null | undefined): string {
  if (typeof raw !== "string") return FALLBACK
  // Sem isto, 'evil.com' resolveria pra BASE/evil.com e passaria como se fosse interno.
  if (!raw.startsWith("/")) return FALLBACK

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return FALLBACK
  }

  // Resolver com o parser de URL e o que fecha os bypasses: '//evil.com',
  // '/\evil.com' (o parser normaliza a barra invertida) e '/<tab>/evil.com' (o
  // parser remove o caractere de controle) todos acabam com outra origem. E a mesma
  // normalizacao que o browser faria ao seguir o Location.
  if (url.origin !== BASE) return FALLBACK

  const path = `${url.pathname}${url.search}`

  if (path === "/login" || path.startsWith("/login?")) return FALLBACK
  if (path === "/cadastro" || path.startsWith("/cadastro?")) return FALLBACK
  if (path === "/seja-bem-vindo" || path.startsWith("/seja-bem-vindo?")) return FALLBACK

  return path
}

// Destino de primeiro acesso. O deep link viaja no ?next= porque
// normalizeRedirectTarget rejeita /seja-bem-vindo — passa-la como destino
// devolveria o usuario pra ela depois da CTA.
export function welcomeHref(destination: string): string {
  if (destination === FALLBACK) return "/seja-bem-vindo"
  return `/seja-bem-vindo?next=${encodeURIComponent(destination)}`
}
