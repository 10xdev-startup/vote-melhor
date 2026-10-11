import type { ImportResource, OfficialDataAdapter } from '@/types/officialData'

const PROCESS_URL = 'https://app2.licitardigital.com.br/pesquisa/113514'
const PROCESS_ID = '113514'

export interface LicitarDocument {
  name: string
  title: string
  label: string
  url: string
  fileName: string
}

/** Arquivos que a página pública do processo já publica. A ata da sala ainda não existe: a disputa é em 13/10/2026. */
export const LICITAR_DOCUMENTS: LicitarDocument[] = [
  {
    name: '113514-impugnacao-assinada',
    title: 'Impugnação ao edital — Pregão 004/2026 IPASMUN',
    label: 'Impugnação',
    fileName: 'impugnacao-assinada.pdf',
    url: 'https://arquivos.licitardigital.com.br/3925d809-bb69-49dc-adda-30b0faa5aa58.pdf',
  },
  {
    name: '113514-julgamento-impugnacao',
    title: 'Julgamento da impugnação — Pregão 004/2026 IPASMUN',
    label: 'Julgamento',
    fileName: 'IMPUGNACAO_assinado.pdf',
    url: 'https://arquivos.licitardigital.com.br/8de7527f-e4f4-477c-bbe7-4ffa7f6439e5.pdf',
  },
  {
    name: '113514-edital',
    title: 'Edital Pregão Software RPPS — Pregão 004/2026 IPASMUN',
    label: 'Edital',
    fileName: 'Pregao_Software_RPPS.pdf',
    url: 'https://licitar-signed-documents.s3.sa-east-1.amazonaws.com/1315/1a6b6706-b64f-4de5-b95c-f6f8db5b492e',
  },
]

export function anexosForDisputa(disputaUrl: string | null): { name: string; label: string }[] {
  if (!disputaUrl?.includes(`/pesquisa/${PROCESS_ID}`)) return []
  return [
    LICITAR_DOCUMENTS.find((document) => document.name.endsWith('-edital')),
    ...LICITAR_DOCUMENTS.filter((document) => !document.name.endsWith('-edital')),
  ].flatMap((document) => document ? [{ name: document.name, label: document.label }] : [])
}

export function assertLicitarPdf(body: Buffer): void {
  if (body.length < 5 || body.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Arquivo não é um PDF da Licitar Digital')
}

function resource(document: LicitarDocument): ImportResource {
  return {
    name: document.name,
    title: document.title,
    official_id: PROCESS_ID,
    url: document.url,
    format: 'PDF',
    kind: 'document',
    dependencies: [],
    optional: true,
    parserVersion: 'licitar-anexo-pdf-v1',
    schema: {
      purpose: 'original-archive',
      processId: PROCESS_ID,
      processUrl: PROCESS_URL,
      fileName: document.fileName,
      organ: 'Instituto de Previdência dos Servidores Municipais de Nanuque',
      bidding: 'Pregão eletrônico 004/2026',
    },
    parse(body) {
      assertLicitarPdf(body)
      return []
    },
    validate: () => ({ pdfSignature: true, archiveOnly: true }),
  }
}

export const licitarDigitalAdapter: OfficialDataAdapter = {
  id: 'licitar-digital',
  allowedHosts: ['arquivos.licitardigital.com.br', 'licitar-signed-documents.s3.sa-east-1.amazonaws.com'],
  async discover() {
    return {
      source: {
        id: 'licitar-digital',
        title: 'Anexos publicados na Licitar Digital',
        organization: 'Instituto de Previdência dos Servidores Municipais de Nanuque',
        jurisdiction_code: '31',
        official_url: PROCESS_URL,
        metadata: {
          platform: 'Licitar Digital',
          processId: PROCESS_ID,
          bidding: 'Pregão eletrônico 004/2026',
          processNumber: '31/2026',
          disputeAt: '2026-10-13T08:00:00-03:00',
          concept: 'PDFs que a página pública do processo já oferece para download. A lista de atas da plataforma não entra enquanto o arquivo não existir.',
          files: LICITAR_DOCUMENTS.map((document) => document.fileName),
        },
      },
      resources: LICITAR_DOCUMENTS.map(resource),
    }
  },
}
