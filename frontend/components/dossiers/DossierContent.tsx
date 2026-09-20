'use client'

import { createElement, Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { parseDossierMarkdown, safeDossierLink, type MarkdownNode } from '@/lib/dossierMarkdown'
import type { Dossier } from '@/types/dossier'

function renderNodes(nodes: MarkdownNode[]): ReactNode {
  return nodes.map(({ token, children }, index) => {
    const body = renderNodes(children)
    switch (token.type) {
      case 'inline': return <Fragment key={index}>{body}</Fragment>
      case 'text': return token.content
      case 'softbreak': return ' '
      case 'hardbreak': return <br key={index} />
      case 'code_inline': return <code key={index} className="break-words rounded bg-muted px-1 font-mono text-[0.9em]">{token.content}</code>
      case 'fence': case 'code_block': return <pre key={index} className="my-6 overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-6"><code>{token.content}</code></pre>
      case 'heading_open': return createElement(token.tag, { key: index, className: 'mb-3 mt-9 text-xl font-semibold tracking-tight' }, body)
      case 'paragraph_open': return <p key={index} className="my-3 leading-7">{body}</p>
      case 'strong_open': return <strong key={index}>{body}</strong>
      case 'em_open': return <em key={index}>{body}</em>
      case 's_open': return <s key={index}>{body}</s>
      case 'link_open': return <a key={index} href={safeDossierLink(token.attrGet('href'))} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline underline-offset-4">{body}</a>
      case 'bullet_list_open': return <ul key={index} className="my-4 list-disc space-y-2 pl-6">{body}</ul>
      case 'ordered_list_open': return <ol key={index} start={Number(token.attrGet('start') ?? 1)} className="my-4 list-decimal space-y-2 pl-6">{body}</ol>
      case 'list_item_open': return <li key={index}>{body}</li>
      case 'blockquote_open': return <blockquote key={index} className="my-5 border-l-4 border-primary/40 pl-4 text-muted-foreground">{body}</blockquote>
      case 'table_open': return <div key={index} className="my-6 overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm">{body}</table></div>
      case 'thead_open': return <thead key={index} className="bg-muted">{body}</thead>
      case 'tbody_open': return <tbody key={index}>{body}</tbody>
      case 'tr_open': return <tr key={index} className="border-b last:border-0">{body}</tr>
      case 'th_open': case 'td_open': return createElement(token.tag, { key: index, className: 'min-w-28 px-4 py-3 align-top' }, body)
      case 'hr': return <hr key={index} className="my-8" />
      default: return <Fragment key={index}>{token.content}{body}</Fragment>
    }
  })
}
export function DossierContent({ dossier, isDraft = false }: { dossier: Dossier; isDraft?: boolean }) {
  const nodes = useMemo(() => parseDossierMarkdown(dossier.content.markdown), [dossier.content.markdown])
  return <article className="mx-auto max-w-3xl">
    <header className="mb-8 border-b pb-7">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vote Melhor · Dossiê {isDraft && '· Rascunho'}</p>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{dossier.content.title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">Acompanhe a análise no código. Clone o repositório para explorar a implementação:</p>
      <a href="https://github.com/10xdev-startup/vote-melhor" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-sm text-primary underline">https://github.com/10xdev-startup/vote-melhor</a>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs"><code>git clone https://github.com/10xdev-startup/vote-melhor.git</code></pre>
    </header>
    <div className="text-sm md:text-base">{renderNodes(nodes)}</div>
    <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
      <p>O clone traz a versão atual do repositório; esta análise descreve o commit abaixo.</p>
      <a href={`https://github.com/10xdev-startup/vote-melhor/tree/${dossier.content.codeCommit}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all underline">Código analisado: {dossier.content.codeCommit}</a>
      {!isDraft && dossier.publishedAt && <p className="mt-2">Publicado em {new Date(dossier.publishedAt).toLocaleDateString('pt-BR')}</p>}
    </footer>
  </article>
}
