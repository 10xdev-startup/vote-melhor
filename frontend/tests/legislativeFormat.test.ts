import { describe, expect, it } from '@jest/globals'
import { daysBetweenDates, formatSessionDate } from '@/lib/legislativeFormat'

describe('formatSessionDate', () => {
  it('formata data legislativa sem conversão de fuso', () => {
    expect(formatSessionDate('2026-08-12')).toBe('12/08/2026')
  })

  it('ignora a hora de um timestamp ISO', () => {
    expect(formatSessionDate('2026-07-08T12:27:06.747')).toBe('08/07/2026')
  })
})

describe('daysBetweenDates', () => {
  it('conta dias civis sem deslocamento de fuso', () => {
    expect(daysBetweenDates('2026-05-28', '2026-08-17T03:00:00.000Z')).toBe(81)
  })

  it('não publica duração para valores inválidos ou invertidos', () => {
    expect(daysBetweenDates(null, '2026-08-17')).toBeNull()
    expect(daysBetweenDates('2026-08-18', '2026-08-17')).toBeNull()
  })
})
