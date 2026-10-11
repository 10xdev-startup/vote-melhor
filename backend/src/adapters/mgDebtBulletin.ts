import type { ImportResource, OfficialCollector, OfficialDataAdapter } from '@/types/officialData'

const LIST_URL = 'https://www.fazenda.mg.gov.br/tesouro-estadual/divida-publica/boletins-da-divida-publica/'
const ORIGIN = 'https://www.fazenda.mg.gov.br'
const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}
const MONTH_NAMES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export interface BulletinLink { year: number; month: number; url: string }

/** O boletim não traz uma taxa única. Guarda o indexador e os juros pagos no mês. */
export function assertDebtBulletinPdf(body: Buffer): void {
  if (body.length < 5 || body.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Arquivo não é um PDF do boletim da dívida')
}

function absolute(href: string): string {
  return new URL(href.replaceAll('&amp;', '&'), ORIGIN).href
}

function monthOf(href: string): { year: number; month: number } | null {
  const match = /\/([a-zç]+)-de-(20\d\d)/i.exec(href)
  if (!match) return null
  const month = MONTHS[match[1]!.toLowerCase().replace('ç', 'c')]
  return month ? { year: Number(match[2]), month } : null
}

/** Uma entrada por mês. Quando a lista já aponta o PDF, ele vence a página do mês. */
export function bulletinLinks(html: string): BulletinLink[] {
  const chosen = new Map<string, BulletinLink>()
  for (const href of html.match(/href="([^"]*boletins-da-divida-publica\/[^"]+)"/gi) ?? []) {
    const raw = href.slice(6, -1)
    const when = monthOf(raw)
    if (!when) continue
    const url = absolute(raw)
    const key = `${when.year}-${when.month}`
    const current = chosen.get(key)
    if (!current || url.toLowerCase().endsWith('.pdf')) chosen.set(key, { ...when, url })
  }
  return [...chosen.values()].sort((left, right) => left.year - right.year || left.month - right.month)
}

export function pdfLink(html: string): string | null {
  const href = html.match(/href="([^"]+\.pdf)"/i)?.[1]
  return href ? absolute(href) : null
}

function resource(year: number, month: number, url: string): ImportResource {
  const reference = `${year}-${String(month).padStart(2, '0')}`
  return {
    name: `boletim-${reference}`,
    title: `Boletim da dívida pública — ${MONTH_NAMES[month]} de ${year}`,
    official_id: null,
    url,
    format: 'PDF',
    kind: 'document',
    dependencies: [],
    optional: true,
    parserVersion: 'mg-debt-bulletin-pdf-v1',
    schema: {
      purpose: 'original-archive',
      concept: 'Composição do estoque por indexador e juros pagos no mês. Não é uma taxa única da dívida.',
      reference,
      listUrl: LIST_URL,
    },
    parse(body) {
      assertDebtBulletinPdf(body)
      return []
    },
    validate: () => ({ pdfSignature: true, archiveOnly: true, interestRateExtracted: false }),
  }
}

export const mgDebtBulletinAdapter: OfficialDataAdapter = {
  id: 'mg-debt-bulletin',
  allowedHosts: ['www.fazenda.mg.gov.br'],
  async discover(collect: OfficialCollector) {
    const index = await collect(LIST_URL)
    const links = bulletinLinks(index.body.toString('utf8'))
    const resources: ImportResource[] = []
    for (const link of links) {
      const pdf = link.url.toLowerCase().endsWith('.pdf') ? link.url : pdfLink((await collect(link.url)).body.toString('utf8'))
      if (pdf) resources.push(resource(link.year, link.month, pdf))
    }
    const years = [...new Set(resources.map((item) => String((item.schema as { reference: string }).reference).slice(0, 4)))]
    return {
      source: {
        id: 'mg-debt-bulletin',
        title: 'Boletim da dívida pública de Minas Gerais',
        organization: 'Secretaria de Estado de Fazenda de Minas Gerais',
        jurisdiction_code: '31',
        official_url: LIST_URL,
        metadata: {
          concept: 'Originais mensais publicados na página da dívida. Cada arquivo é um mês, não a série desde 2000. A taxa única não está no PDF; o que ele publica é o indexador do estoque e os juros pagos.',
          coverage: years.length ? `${years[0]}–${years.at(-1)}` : 'nenhum boletim localizado',
          months: resources.length,
          absentBefore: 2020,
        },
      },
      resources,
    }
  },
}
