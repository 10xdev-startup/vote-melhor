/**
 * Atalhos de busca por tema nas matérias do Senado.
 *
 * Tema NÃO é busca de frase. A ementa da `PEC 6/2019` diz "Modifica o sistema de previdência
 * social" — procurar a string "reforma da previdência" não casaria nada. Cada tema é um
 * conjunto de radicais casados por OU, o que sobrevive às variações que o texto legislativo
 * usa ("previdenciário", "aposentadoria", "INSS").
 *
 * A curadoria é descritiva, não editorial: agrupa por assunto, nunca por posição. E a ordem
 * na tela é por cobertura medida no dado, nunca por relevância atribuída — ordenar temas por
 * juízo de importância seria o mesmo problema que ordenar partidos por ideologia.
 *
 * Contagens medidas em 399 matérias do recorte 2019-2026, em 16/08/2026.
 */

export interface SenadoTheme {
  id: string
  label: string
  /** Radicais já sem acento e em minúsculas. Casam por `includes`, então prefixo basta. */
  keywords: string[]
}

/**
 * Radical curto e ambíguo leva espaço no fim (`'sus '`, `'gas '`) para não casar dentro de
 * outra palavra — sem isso, `sus` casaria "suspensão" e `gas` casaria "gasto".
 */
export const SENADO_THEMES: SenadoTheme[] = [
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

/**
 * Minúsculas e sem acento, dos dois lados da comparação.
 *
 * O escape `\u0300-\u036f` é obrigatório aqui: o combining mark literal renderiza igual e
 * passa em teste e lint, mas vira lixo quando o arquivo atravessa qualquer camada que não
 * seja UTF-8. Ver a regra de regex de acento no `CLAUDE.md`.
 */
export function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function matchesTheme(text: string, theme: SenadoTheme): boolean {
  const normalized = normalizeForSearch(text)
  return theme.keywords.some((keyword) => normalized.includes(keyword))
}

/** Quantas matérias cada tema alcança. Vai no chip para o número na tela ser medido, não prometido. */
export function countByTheme(materias: Array<{ identification: string; summary: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const theme of SENADO_THEMES) {
    counts[theme.id] = materias.filter((materia) => matchesTheme(`${materia.identification} ${materia.summary ?? ''}`, theme)).length
  }
  return counts
}
