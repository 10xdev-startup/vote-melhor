/** `2026-08-12` ou um timestamp ISO → `12/08/2026`, sem deslocamento por fuso. */
export function formatSessionDate(value: string | null): string {
  if (!value) return '—'
  const date = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

/** Dias civis completos entre duas datas ISO, sem depender do fuso do navegador. */
export function daysBetweenDates(start: string | null, end: string | null): number | null {
  const parse = (value: string | null): number | null => {
    if (!value) return null
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (!match) return null
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const startTime = parse(start)
  const endTime = parse(end)
  if (startTime === null || endTime === null || endTime < startTime) return null
  return Math.floor((endTime - startTime) / 86_400_000)
}
