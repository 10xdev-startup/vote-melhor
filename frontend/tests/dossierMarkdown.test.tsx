import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { parseDossierMarkdown, markdownText, safeDossierLink } from '@/lib/dossierMarkdown'
import { DossierContent } from '@/components/dossiers/DossierContent'
const markdown = '## Fonte\n\nTexto **forte** e *ênfase*.\n\n| Nome | Valor |\n| --- | --- |\n| Ação | 100 |\n\n```text\n┌─ órgão ─┐\n│  dado   │\n└─────────┘\n```\n\n[Senado](https://senado.leg.br)\n\n<script>alert(1)</script>\n\n[ruim](javascript:alert(1))'
describe('Markdown de dossiês', () => {
  it('conserva tabela, diagrama, código e acentos na árvore', () => {
    const nodes = parseDossierMarkdown(markdown)
    expect(markdownText(nodes)).toContain('Ação100')
    expect(nodes.find((node) => node.token.type === 'fence')?.token.content).toBe('┌─ órgão ─┐\n│  dado   │\n└─────────┘\n')
  })
  it('web não executa HTML nem links inseguros', () => {
    const { container } = render(<DossierContent dossier={{ slug: 'senado', content: { title: 'Senado', markdown, sourceId: null, codeCommit: 'a'.repeat(40) }, publishedAt: '2026-09-20T12:00:00Z' }} />)
    expect(container.querySelector('script')).toBeNull(); expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(screen.getByRole('link', { name: 'Senado' })).toHaveAttribute('href', 'https://senado.leg.br')
    expect(screen.getByRole('cell', { name: 'Ação' })).toBeInTheDocument()
    expect(safeDossierLink('file:///tmp/a')).toBeUndefined()
  })
})
