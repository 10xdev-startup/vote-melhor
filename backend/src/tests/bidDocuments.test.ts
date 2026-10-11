import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from '@jest/globals'
import { documentsFromLicitanetPage, documentsFromLicitar, documentsFromPncp, documentsFromPortal, licitanetSessionId, licitarProcessId, pncpPurchase, portalProcessId, zipPdfBytes, zipPdfEntries } from '@/services/bidDocuments'

describe('documentos de uma licitação', () => {
  it('lê o processo no link do PNCP e da Licitar', () => {
    expect(pncpPurchase('https://pncp.gov.br/app/editais/46522975000180/2026/87')).toEqual({ cnpj: '46522975000180', ano: '2026', sequencial: '87' })
    expect(pncpPurchase('https://example.com/app/editais/46522975000180/2026/87')).toBeNull()
    expect(licitarProcessId('https://app2.licitardigital.com.br/pesquisa/115616')).toBe('115616')
    expect(licitarProcessId('https://compras.gov.br/x')).toBeNull()
    expect(licitanetSessionId('https://licitanet.com.br/sessao/203682')).toBe('203682')
    expect(licitanetSessionId('https://compras.gov.br/x')).toBeNull()
  })

  it('trata lista vazia como ausência de arquivo', () => {
    expect(documentsFromPncp({ status: 404 })).toEqual([])
    expect(documentsFromPncp([])).toEqual([])
    expect(documentsFromLicitar({ data: [] }, { data: [] })).toEqual([])
  })

  it('fica só com PDF de origem permitida', () => {
    const found = documentsFromPncp([{ titulo: 'Edital', url: 'https://pncp.gov.br/arquivos/edital.pdf' }, { titulo: 'Outro', url: 'https://evil.example/x.pdf' }])
    expect(found).toEqual([{ label: 'Edital', url: 'https://pncp.gov.br/arquivos/edital.pdf' }])
    const licitar = documentsFromLicitar({ data: [] }, { data: [{ fileDescription: 'Edital', url: 'https://arquivos.licitardigital.com.br/edital.pdf' }] })
    expect(licitar[0]?.label).toBe('Edital')
  })

  it('lê os PDFs publicados no Portal de Compras Públicas', () => {
    expect(portalProcessId('https://www.portaldecompraspublicas.com.br/processos/MG/Prefeitura-Municipal-Brasilia-de-Minas-2321/PE-043-2026-2026-517330')).toBe('517330')
    expect(portalProcessId('https://licitanet.com.br/sessao/203682')).toBeNull()
    const found = documentsFromPortal([
      { nome: 'EDITAL- software.pdf', url: 'https://arquivos.portaldecompraspublicas.com.br/v1/download/aaa', tipo: 'Edital' },
      { nome: 'EDITAL 1 RETIFICAÇÃO.pdf', url: 'https://arquivos.portaldecompraspublicas.com.br/v1/download/bbb', tipo: 'Edital' },
      { nome: 'fora.pdf', url: 'https://evil.example/x.pdf', tipo: 'Edital' },
    ])
    expect(found).toEqual([
      { label: 'Edital', url: 'https://arquivos.portaldecompraspublicas.com.br/v1/download/aaa' },
      { label: 'Edital retificado', url: 'https://arquivos.portaldecompraspublicas.com.br/v1/download/bbb' },
    ])
  })

  it('abre o PDF que está dentro do zip do edital', () => {
    const pdf = Buffer.from('%PDF-1.4 edital')
    const packed = deflateRawSync(pdf)
    const name = Buffer.from('edital/EDITAL_assinado.pdf')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(pdf.length, 22)
    local.writeUInt16LE(name.length, 26)
    const zip = Buffer.concat([local, name, packed])
    expect(zipPdfEntries(zip)).toEqual([{ name: 'edital/EDITAL_assinado.pdf' }])
    expect(zipPdfBytes(zip, 'edital/EDITAL_assinado.pdf')?.toString('ascii')).toBe('%PDF-1.4 edital')
    expect(zipPdfBytes(zip, '../segredo.pdf')).toBeNull()
  })

  it('lê o edital publicado na sessão da Licitanet', () => {
    const html = `<div data-page="{&quot;props&quot;:{&quot;disputeRoom&quot;:{&quot;notices&quot;:[{&quot;name&quot;:&quot;203682_editais.zip&quot;,&quot;link&quot;:&quot;https://d2e4y9pc28eke4.cloudfront.net/pregao/203682/documentos/edital.zip&quot;}]}}}"></div>`
    expect(documentsFromLicitanetPage(html)).toEqual([{ label: 'Edital', url: 'https://d2e4y9pc28eke4.cloudfront.net/pregao/203682/documentos/edital.zip' }])
  })
})