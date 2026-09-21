import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Document, Page, Text, View, Link, Font, StyleSheet } from '@react-pdf/renderer'
import { parseDossierMarkdown, markdownText, safeDossierLink, type MarkdownNode } from '@/lib/dossierMarkdown'
import type { DossierPdfModel } from '@/lib/dossierPdf'

export function registerDossierFonts(base = '/fonts/dossiers') {
  Font.register({ family: 'DossierSans', fonts: [
    { src: `${base}/DejaVuSans.ttf` },
    { src: `${base}/DejaVuSans-Bold.ttf`, fontWeight: 700 },
    { src: `${base}/DejaVuSansMono-Oblique.ttf`, fontStyle: 'italic' },
    { src: `${base}/DejaVuSansMono-Oblique.ttf`, fontStyle: 'italic', fontWeight: 700 },
  ] })
  Font.register({ family: 'DossierMono', src: `${base}/DejaVuSansMono.ttf` })
  Font.registerHyphenationCallback((word) => word.length > 60 ? Array.from(word) : [word])
}
const styles = StyleSheet.create({
  page: { padding: 44, paddingBottom: 60, fontFamily: 'DossierSans', fontSize: 10, lineHeight: 1.55, color: '#202b32' },
  title: { fontSize: 25, lineHeight: 1.2, fontWeight: 700, marginBottom: 16 },
  brand: { fontSize: 9, color: '#0f766e', letterSpacing: 1.5, marginBottom: 14 },
  meta: { fontSize: 8, color: '#64748b', marginBottom: 5 },
  heading: { fontSize: 15, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  paragraph: { marginBottom: 10 },
  code: { fontFamily: 'DossierMono', fontSize: 8.5, lineHeight: 1.35, padding: 10, marginVertical: 8, backgroundColor: '#f1f5f9' },
  quote: { borderLeftWidth: 3, borderLeftColor: '#0f766e', paddingLeft: 12, marginVertical: 8 },
  footer: { position: 'absolute', top: 790, left: 0, right: 0, fontSize: 8, textAlign: 'center', color: '#64748b' },
  cell: { padding: 6, fontFamily: 'DossierMono', fontSize: 8, lineHeight: 1.4, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' },
})

function inline(nodes: MarkdownNode[]): ReactNode {
  return nodes.map(({ token, children }, i) => {
    if (token.type === 'text') return token.content
    if (token.type === 'softbreak') return ' '
    if (token.type === 'hardbreak') return '\n'
    if (token.type === 'code_inline') return <Text key={i} style={{ fontFamily: 'DossierMono', fontSize: 9 }}>{token.content}</Text>
    if (token.type === 'link_open') return <Link key={i} src={safeDossierLink(token.attrGet('href'))} style={{ color: '#0f766e', textDecoration: 'underline' }}>{inline(children)}</Link>
    return <Text key={i} style={{ fontWeight: token.type === 'strong_open' ? 700 : undefined, fontStyle: token.type === 'em_open' ? 'italic' : undefined, textDecoration: token.type === 's_open' ? 'line-through' : undefined }}>{children.length ? inline(children) : token.content}</Text>
  })
}

function monoWidth(text: string, size: number): number {
  const font = Font.getFont({ fontFamily: 'DossierMono' }).data
  if (!font) throw new Error('Fonte do PDF ainda não carregada')
  return font.layout(text).glyphs.reduce((sum: number, glyph: { advanceWidth: number }) => sum + glyph.advanceWidth, 0) * size / font.unitsPerEm
}
function wrapCell(text: string, width: number): string {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && monoWidth(`${line} ${word}`, 8) <= width) { line += ` ${word}`; continue }
    if (line) { lines.push(line); line = '' }
    for (const character of word) {
      if (monoWidth(line + character, 8) > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines.join('\n')
}
function tableGroups(node: MarkdownNode, availableWidth: number): { header: string[]; groups: string[][][] } {
  const headerNodes = node.children.find((child) => child.token.type === 'thead_open')?.children[0]?.children ?? []
  const body = node.children.find((child) => child.token.type === 'tbody_open')?.children ?? []
  if (!headerNodes.length || headerNodes.length > 6) throw new Error('Tabelas do PDF precisam ter entre 1 e 6 colunas. Divida a tabela no Markdown.')
  const width = availableWidth / headerNodes.length - 12
  const header = headerNodes.map((cell) => wrapCell(markdownText(cell.children), width))
  const headerLines = Math.max(...header.map((cell) => cell.split('\n').length))
  const groups: string[][][] = []
  let group: string[][] = []
  let used = headerLines + 2
  for (const row of body) {
    const cells = row.children.map((cell) => wrapCell(markdownText(cell.children), width))
    const lines = Math.max(...cells.map((cell) => cell.split('\n').length)) + 2
    if (lines + headerLines > 40) throw new Error('Uma célula da tabela é longa demais para A4. Divida o conteúdo em linhas menores no Markdown.')
    if (used + lines > 40 && group.length) { groups.push(group); group = []; used = headerLines + 2 }
    group.push(cells); used += lines
  }
  if (group.length || !groups.length) groups.push(group)
  return { header, groups }
}

function blocks(nodes: MarkdownNode[], depth = 0): ReactNode {
  return nodes.map((node, i) => {
    const { token, children } = node
    const width = 507.28 - depth * 16
    switch (token.type) {
      case 'heading_open': return <Text key={i} minPresenceAhead={28} style={[styles.heading, token.tag === 'h3' ? { fontSize: 12, marginTop: 12 } : {}]}>{inline(children)}</Text>
      case 'paragraph_open': return <Text key={i} orphans={2} widows={2} style={styles.paragraph}>{inline(children)}</Text>
      case 'fence': case 'code_block': {
        const lines = token.content.replace(/\n$/, '').replace(/\t/g, '    ').split('\n')
        if (lines.some((line) => monoWidth(line, 8.5) > width - 20)) throw new Error('Código ou diagrama largo demais para A4. Divida as linhas no Markdown; o PDF não corta conteúdo.')
        return <Fragment key={i}>{Array.from({ length: Math.ceil(lines.length / 38) }, (_, n) => <Text key={n} wrap={false} style={styles.code}>{lines.slice(n * 38, n * 38 + 38).join('\n').replace(/ /g, '\u00a0') || '\u00a0'}</Text>)}</Fragment>
      }
      case 'bullet_list_open': case 'ordered_list_open': return <View key={i}>{children.map((item, j) => <View key={j} style={{ flexDirection: 'row' }}><Text style={{ width: 16 }}>{token.type === 'bullet_list_open' ? '•' : `${Number(token.attrGet('start') ?? 1) + j}.`}</Text><View style={{ flex: 1 }}>{blocks(item.children, depth + 1)}</View></View>)}</View>
      case 'blockquote_open': return <View key={i} style={styles.quote}>{blocks(children, depth + 1)}</View>
      case 'table_open': {
        const { header, groups } = tableGroups(node, width)
        const row = (cells: string[], key: string, isHeader = false) => <View key={key} style={{ flexDirection: 'row', backgroundColor: isHeader ? '#e2e8f0' : '#ffffff' }}>{cells.map((cell, j) => <Text key={j} style={[styles.cell, { width: `${100 / header.length}%` }]}>{cell}</Text>)}</View>
        return <View key={i} style={{ marginVertical: 10 }}>{groups.map((group, n) => <View key={n} wrap={false}>{row(header, 'header', true)}{group.map((cells, j) => row(cells, String(j)))}</View>)}</View>
      }
      case 'hr': return <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginVertical: 10 }} />
      default: return <Text key={i}>{inline([node])}</Text>
    }
  })
}

export async function prepareDossierPdf(model: DossierPdfModel): Promise<void> {
  await Promise.all([Font.load({ fontFamily: 'DossierSans' }), Font.load({ fontFamily: 'DossierMono' })])
  const font = Font.getFont({ fontFamily: 'DossierSans' }).data!
  const mono = Font.getFont({ fontFamily: 'DossierMono' }).data!
  for (const character of model.content.title + model.content.markdown) {
    const code = character.codePointAt(0)!
    if (!/\s/.test(character) && !font.hasGlyphForCodePoint(code) && !mono.hasGlyphForCodePoint(code)) throw new Error(`Caractere sem fonte no PDF: ${character}. Substitua-o no Markdown.`)
  }
  // Validação de largura antes de iniciar o renderizador assíncrono.
  blocks(parseDossierMarkdown(model.content.markdown))
}

export function DossierPdfDocument({ model }: { model: DossierPdfModel }) {
  return <Document title={model.content.title} author="Vote Melhor" language="pt-BR" creator="Vote Melhor">
    <Page size="A4" style={styles.page} wrap experimentalPagination layout={({ children, pageNumber, totalPages }) => <>{children}<Text style={styles.footer}>Vote Melhor · {model.isDraft ? 'RASCUNHO · ' : ''}{pageNumber} / {totalPages}</Text></>}>
      <Text style={styles.brand}>VOTE MELHOR / DOSSIÊ {model.isDraft ? '/ RASCUNHO' : ''}</Text>
      <Text style={styles.title}>{model.content.title}</Text>
      <Text style={styles.meta}>Acompanhe a análise no código. Clone o repositório para explorar a implementação:</Text>
      <Link src="https://github.com/10xdev-startup/vote-melhor" style={styles.meta}>https://github.com/10xdev-startup/vote-melhor</Link>
      <Text wrap={false} style={styles.code}>git clone https://github.com/10xdev-startup/vote-melhor.git</Text>
      {blocks(parseDossierMarkdown(model.content.markdown))}
      <View wrap={false} style={{ marginTop: 18, borderTopWidth: 0.5, borderTopColor: '#cbd5e1', paddingTop: 10 }}>
        <Text style={styles.meta}>Referência técnica: o clone traz a versão atual do repositório; esta análise descreve o commit abaixo.</Text>
        <Link src={`https://github.com/10xdev-startup/vote-melhor/tree/${model.content.codeCommit}`} style={styles.meta}>Código analisado: {model.content.codeCommit}</Link>
        {!model.isDraft && model.publishedAt && <Text style={styles.meta}>Publicado em {new Date(model.publishedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</Text>}
        {!model.isDraft && /^https:\/\//.test(model.publicUrl) && <Link src={model.publicUrl} style={styles.meta}>Leia este dossiê online: {model.publicUrl}</Link>}
      </View>
    </Page>
  </Document>
}
