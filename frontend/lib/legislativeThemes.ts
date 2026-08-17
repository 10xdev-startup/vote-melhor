/**
 * Atalhos temáticos compartilhados pelas pautas da Câmara e do Senado.
 *
 * Tema não é busca de frase. Cada tema usa radicais casados por OU para sobreviver às
 * variações do texto legislativo (por exemplo, “previdenciário”, “aposentadoria” e “INSS”).
 * A curadoria agrupa por assunto, nunca por posição política; cada tela mostra a contagem
 * medida em seu próprio recorte.
 */

export interface LegislativeTheme {
  id: string
  label: string
  /** Radicais já sem acento e em minúsculas. Casam por `includes`, então prefixo basta. */
  keywords: string[]
}

/**
 * Radical curto e ambíguo leva espaço no fim (`'sus '`, `'gas '`) para não casar dentro de
 * outra palavra — sem isso, `sus` casaria “suspensão” e `gas` casaria “gasto”.
 */
export const LEGISLATIVE_THEMES: LegislativeTheme[] = [
  { id: 'orcamento', label: 'Orçamento e gastos', keywords: ['orcament', 'fiscal', 'despesa', 'divida', 'credito', 'precatorio'] },
  { id: 'saude', label: 'Saúde', keywords: ['saude', 'hospital', 'medic', 'sus ', 'sanitar', 'vacina'] },
  { id: 'tributos', label: 'Impostos e tributos', keywords: ['tributar', 'imposto', 'ibs', 'cbs', 'pis', 'cofins', 'icms', 'iss '] },
  { id: 'seguranca', label: 'Segurança pública', keywords: ['seguranca publica', 'policia', 'penal', 'crime', 'armas', 'penitenci'] },
  { id: 'educacao', label: 'Educação', keywords: ['educac', 'escola', 'ensino', 'universidad', 'professor', 'fundeb'] },
  { id: 'previdencia', label: 'Previdência e aposentadoria', keywords: ['previdenc', 'aposentad', 'inss', 'pensao'] },
  { id: 'energia', label: 'Energia', keywords: ['energia', 'eletric', 'petrole', 'combustivel', 'gas '] },
  { id: 'trabalho', label: 'Trabalho e emprego', keywords: ['trabalh', 'emprego', 'salario', 'clt', 'jornada', 'sindic'] },
  { id: 'eleicoes', label: 'Eleições e partidos', keywords: ['eleitor', 'eleic', 'partido', 'candidat', 'urna', 'campanha'] },
  { id: 'mulheres', label: 'Direitos das mulheres', keywords: ['mulher', 'femin', 'gestante', 'materni'] },
]

/** Minúsculas e sem acento, dos dois lados da comparação. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function matchesTheme(text: string, theme: LegislativeTheme): boolean {
  const normalized = normalizeForSearch(text)
  return theme.keywords.some((keyword) => normalized.includes(keyword))
}

/** Conta quantos textos oficiais cada tema alcança. */
export function countThemesInTexts(texts: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const theme of LEGISLATIVE_THEMES) counts[theme.id] = texts.filter((text) => matchesTheme(text, theme)).length
  return counts
}
