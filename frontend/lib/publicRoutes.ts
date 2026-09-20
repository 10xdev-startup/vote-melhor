// Rotas abertas a visitante. Ler dado oficial nao exige conta: o hub e as tres telas de
// dado entram aqui junto da landing e das telas de entrada. O que depende de usuario
// (/seja-bem-vindo, /componentes) fica de fora e continua atras do gate.
const PUBLIC_PATHS = ['/', '/login', '/cadastro', '/inicio', '/camara', '/senado', '/fonte-de-dados', '/dossies']

// Prefixo, e nao path exato, porque cada campanha publica a propria rota sob /lp/. A lista
// de cima nunca vira prefixo: '/camara' como prefixo abriria '/camara-secreta' junto.
const PUBLIC_PREFIXES = ['/lp/', '/dossies/']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
