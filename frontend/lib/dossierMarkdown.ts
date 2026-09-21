import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

const parser = new MarkdownIt({ html: false, linkify: false, typographer: false })

// A árvore é transitória: os adaptadores web e PDF leem os mesmos tokens.
export interface MarkdownNode {
  token: Token
  children: MarkdownNode[]
}
function nest(tokens: Token[]): MarkdownNode[] {
  const root: MarkdownNode[] = []
  const stack = [root]
  for (const token of tokens) {
    if (token.nesting === -1) { stack.pop(); continue }
    const node = { token, children: token.children ? nest(token.children) : [] }
    stack[stack.length - 1].push(node)
    if (token.nesting === 1) stack.push(node.children)
  }
  return root
}
export function parseDossierMarkdown(markdown: string): MarkdownNode[] { return nest(parser.parse(markdown, {})) }
export function markdownText(nodes: MarkdownNode[]): string {
  return nodes.map(({ token, children }) => children.length ? markdownText(children) : ['softbreak', 'hardbreak'].includes(token.type) ? '\n' : token.content).join('')
}
export function safeDossierLink(href: string | null): string | undefined {
  return href && /^https?:\/\//i.test(href) ? href : undefined
}
