/** Formatadores das telas do Senado. Sem HTTP — só apresentação (blueprint §1). */

/** `2026-08-12` → `12/08/2026`. Evita `new Date()`, que desloca o dia por fuso. */
export function formatSessionDate(value: string | null): string {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(0)}%`
}
