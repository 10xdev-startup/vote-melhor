# Execução do piloto de dossiês — 20/09/2026

Implementação autorizada pelo usuário, sem commits, push, deploy ou publicação do Senado. Este registro atualiza o estado de execução; o relatório de engenharia do plano anterior é histórico.

## Para conferir agora

- PDF local, sem servidor: [senado-acesso-aos-dados.rascunho.pdf](./senado-acesso-aos-dados.rascunho.pdf).
- Título: **VoteMelhor — Analisando os dados do Senado**.
- Abre com URL do repositório e comando de clone, depois apresenta utilidade dos dados, cuidados de interpretação e percurso técnico. SHA ao final; sem localhost no documento.
- Rascunho no Supabase: `senado-acesso-aos-dados`, ainda **não publicado**.
- Revisão na aplicação: `/admin/dossies/senado-acesso-aos-dados`.
- Biblioteca pública: `/dossies`; o piloto não aparece nela até a publicação humana.
- Markdown editável local: `.local/dossiers/senado.md`, ignorado pelo Git. O PDF na pasta do plano foi solicitado expressamente pelo usuário e está sem commit.

## O que foi implementado

Uma tabela `dossiers`, um rascunho e uma cópia publicada por slug. Sem histórico, filas, Storage ou editor. Envio pela API existente e autenticação Supabase existente. O autor só envia; o administrador confere o conteúdo e publica. A publicação compara o timestamp integral do rascunho, incluindo microssegundos.

CLI: `backend/scripts/push-dossier.mjs`; testes: `backend/scripts/push-dossier.test.mjs`. Skill: `.claude/skills/dossies/SKILL.md`. O script fica no backend conforme correção do usuário. `sourceId` aponta para o **conjunto** do catálogo, não para cada arquivo CSV/JSON.

PDF: modal, carregamento dinâmico, prévia PDF.js e estados de exportação adaptados de `10x-mkt/frontend/components/ReportPdf{Export,Preview,Renderer}.tsx`, conforme autorização expressa de cópia/adaptação. O documento Markdown é novo, mantendo react-pdf e Blob único para prévia/download. Fontes DejaVu distribuídas com licença em `frontend/public/fonts/dossiers/LICENSE.txt`.

O renderer preserva espaços dos diagramas com espaços não separáveis; mede largura com a fonte carregada; divide código por linhas; divide tabelas com cabeçalhos repetidos; recusa blocos largos ou células altas demais. Rodapé A4 posicionado fora da área de texto após inspeção visual do PDF real.

## Banco e configuração local

DDL validado em transação com rollback e depois aplicado pela Management API no projeto configurado. Inventário posterior confirmou RLS habilitada, zero policies, nenhum SELECT para anon/authenticated, oito constraints, cinco índices (incluindo PK/UNIQUE) e trigger de atualização do rascunho. Nenhuma migration SQL foi adicionada ao repositório.

A conta indicada pelo usuário foi promovida a administradora conforme autorização explícita. Foi criada uma conta autora comum separada, restrita por `DOSSIER_AUTHOR_USER_ID` em `backend/.env`. Sessão/credenciais locais estão em `.env.dossiers`, ignorado pelo Git e com permissão 0600; não copiar seus valores para planos, logs ou comandos inline.

Envio de uma atualização, a partir da raiz, usando sessão válida:

```bash
node --env-file=.env.dossiers backend/scripts/push-dossier.mjs \
  .local/dossiers/senado.md \
  --slug senado-acesso-aos-dados \
  --title 'VoteMelhor — Analisando os dados do Senado' \
  --source-id senado-receitas-proprias \
  --code-commit 36f34316a6041ab0bb09e343b545bf6669b99ad5
```

Acrescentar `--dry-run` valida arquivo/flags/UTF-8/tamanho/commit sem rede. Fonte e autorização são validadas pela API. `API_URL` é a origem do backend. Usar Node 22: o Node 20 deste ambiente não inicializa o cliente Supabase atual por ausência de WebSocket nativo. Um runtime 22 temporário foi instalado somente em `.local/dossiers/runtime`, ignorado.

## Evidência de validação

- Backend: 29 testes focados de validação, Model e rotas passaram, incluindo corpo acima de 100 KiB, JSON inválido, autor/admin, dados privados e publicação concorrente.
- Script: cinco testes passaram; dry-run real do Senado passou.
- Frontend: testes de Markdown, fronteira pública/privada, leitura, publicação e PDF passaram. Download antigo permanece bloqueado após troca de conteúdo; erro permite retry.
- Integração real: script → Express efêmero → JWT normal → Supabase. Senado enviado como rascunho. Autor recebeu 403 na administração; visitante recebeu 404 no piloto; acesso direto à tabela com JWT comum recebeu 403.
- Documento temporário de teste: publicação preservada após novo rascunho; trigger alterou timestamp; tentativa com timestamp antigo recebeu 409. A fixture foi removida ao final.
- PDF real gerado, com texto extraído e páginas inspecionadas. Fixture adicional preservou 75 linhas de tabela e 100 de código, repetiu cabeçalhos e recusou largura/célula excessivas.
- Lint backend passou. Lint frontend sem erros, com um warning preexistente de dependências de useEffect na FonteDeDadosView.
- Os testes da integração Senado citados no texto são os 12 testes com HTTPS mockado da revisão anterior; as medições TLS permanecem históricas. Não houve nova medição TLS.

## Pendências de aceite

Typecheck do frontend e do backend concluído após as últimas alterações. Build do frontend, worker PDF.js no navegador e navegação visual completa ainda não foram validados nesta sessão. O usuário relatou quedas recorrentes do WSL; o PDF independente foi priorizado. Não declarar esses checks como executados. Conferir a interface e o modal quando o ambiente estiver estável; publicação real do Senado depende de revisão humana.

Durante diagnóstico de instalação, um log antigo do npm exibiu um token de gerenciamento na saída da ferramenta. O usuário foi avisado para revogá-lo e substituir a configuração local. Nenhum valor do token foi incluído em arquivo versionável.
