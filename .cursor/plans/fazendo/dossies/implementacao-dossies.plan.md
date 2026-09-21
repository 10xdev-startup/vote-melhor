---
name: dossies-piloto-minimo
overview: Piloto com skill e script no padrão da 10xdev, API e autenticação existentes, uma tabela sem histórico e PDF adaptado da 10xMidia.
todos: []
isProject: false
---

> **Execução autorizada e iniciada:** ver [registro de implementação, PDF e validações](./execucao-dossies.md). O relatório de planejamento abaixo preserva as decisões e o estado anterior à execução.

# Dossiês — piloto mínimo

**Estado:** plano, sem implementação. Atualizado em 20/09/2026 após a revisão de escopo solicitada pelo usuário.

**Decisões do usuário:** simplificar ao máximo para validar a ideia; eliminar versionamento; seguir o padrão da skill `upload-to-10xdev`; **manter renderizador, visualizador, modal e download de PDF da 10xMidia**. PDF por impressão do navegador não é a solução escolhida.

O [briefing original](dossies.plan.md) permanece preservado. Este plano substitui a proposta anterior com revisões, credenciais próprias e RPCs. O [diagnóstico detalhado](diagnostico-dossies.plan.md) conserva versões, caminhos e matriz de reaproveitamento encontrados nos checkouts.

## Problema e menor solução útil

Validar uma única experiência: pedir um dossiê do Senado ao agente, recebê-lo na Vote Melhor, conferir o conteúdo, publicar, ler e baixar o PDF.

Construir **uma skill, um script pequeno, um domínio simples na API existente, uma tabela e a interface de leitura/revisão com PDF**. Nenhum serviço novo. A autoria permanece no Markdown local. A administração permite conferir e publicar, sem editor de texto.

Um dossiê guarda apenas seu rascunho atual e sua cópia pública atual. Não há tabela de revisões, números de versão, histórico, diff, rollback ou URL por revisão. O upload substitui o rascunho; a publicação substitui a cópia pública. As duas cópias permitem conferir uma atualização antes de expô-la, sem construir versionamento.

## O que a upload-to-10xdev realmente faz

Foram lidos a skill e os scripts em `/home/bertucci/code/10xdev/.claude/skills/upload-to-10xdev/`, no checkout `4ba4197e7eaf3d41d1dcaad16f0c3f845f7054fc`, além da cópia existente na 10xMidia.

| Peça existente | Comportamento confirmado | Aplicação no piloto |
|---|---|---|
| `SKILL.md` | Orienta investigação dos arquivos, preparação, dry-run, envio e conferência do link. | Uma rotina equivalente para escrever e enviar o dossiê. |
| `10xdev-card.js` | CLI com `create`, `update`, `show`; lê arquivos do disco; `DRY_RUN=1` encerra antes de chamadas HTTP. | Um único comando de envio por slug e `--dry-run` já bastam. |
| `card-engine.js:463` | `fetch` com JSON e `Authorization: Bearer`, configurado por `API_URL` e `BEARER_TOKEN`. | Usar fetch nativo do Node e a autenticação já existente. |
| `10xdev-card.js:cmdCreate` | POST `/card-features`, opcionalmente vincula projeto e retorna link do card. | PUT de rascunho na Vote Melhor e retorno do link administrativo; sem projeto/cards/abas. |
| `10xdev-card.js:cmdUpdate` | Relê arquivos e faz PUT no mesmo card; substitui conteúdo. | Relê o Markdown e substitui o rascunho do mesmo slug. |
| `backend/src/routes/cardFeatureRoutes.ts` | Escrita autenticada; aprovação/rejeição em rotas de administrador. | Separar envio de publicação usando os guards da Vote Melhor. |
| `backend/src/models/CardFeatureModel.ts:242` | Model grava no Supabase; update verifica autoria e restringe aprovação. | Usar o padrão Controller → Model → Supabase já adotado na Vote Melhor. |

**O script não escreve diretamente no Supabase.** O fluxo real é skill → script → API existente → Supabase. Esse é o caminho recomendado aqui: elimina a necessidade de recriar autenticação e autorização nas operações diretas do script contra o banco. O backend já existe; não é uma infraestrutura nova a implantar.

Não copiar o extrator de símbolos, globs, abas, projetos, parser de “Visão Geral” ou regras de marketing. Também não assumir validade fixa do JWT: a documentação da skill tem relatos diferentes entre cópias; tratar expiração real e 401. Copiar o mecanismo só onde a licença/autorização permitir, não importar o produto inteiro.

## Diagrama e contrato do fluxo

```text
Cursor: skill investiga código + commits + testes + fontes
                         |
                         v
                dossiê local em Markdown
                         |
             script push-dossier.mjs
          valida arquivo --> dry-run ou envio
                         |
             JWT de autor, pela env
                         v
             API Express já existente
      PUT /dossiers/:slug/draft --> valida + grava
                         |
                         v
               Supabase: dossiers
          draft (atual) | published (atual)
                         |
             retorna link administrativo
                         v
          humano abre página de conferência
           lê o rascunho + confere o PDF
                         |
             Publicar (admin existente)
                         v
          published recebe cópia de draft
                         |
            /dossies/:slug (pública)
                         |
                  mesmo conteúdo
                 /              \
           leitura web        PDF no navegador
                              modal + prévia
                              + download
```

Atualização: `draft := novo conteúdo`; `published` continua igual. Publicação: `published := conteúdo conferido`. Não manter cópias anteriores depois da substituição. PDFs já compartilhados continuam existindo com quem os recebeu; a plataforma não permitirá recuperar aquele conteúdo antigo por uma URL de versão.

## Escopo fechado do piloto

- Um autor operacional e um administrador/editor; a mesma pessoa pode operar ambos com credenciais distintas. Sem colaboração simultânea planejada.
- Um dossiê piloto do Senado; lista simples permite novos dossiês depois, sem catálogo editorial complexo.
- Upload determinístico de Markdown, leitura privada, publicação humana, página pública, modal/prévia/download de PDF.
- Uma associação opcional por `sourceId` a um conjunto já existente no catálogo. Link “Entenda como acessamos estes dados” nesse conjunto.
- Autoria somente no Cursor; atualizar significa reenviar o arquivo.

### NOT in scope — fora do piloto

| Item | Motivo |
|---|---|
| Histórico, revisões numeradas, rollback, diff e revisão-base | Não necessários para validar utilidade do documento; removidos a pedido do usuário. |
| Cadastro/gestão de tokens próprios, escopos, expiração e revogação de uma nova credencial | Reusar Supabase Auth e autorização do backend. |
| API de importação separada, Edge Function, MCP, fila ou microsserviço | Script pode usar o Express já existente. |
| AST persistida, hash como identidade editorial, esquema editorial versionado | Guardar Markdown; interpretar para apresentação. |
| Editor visual, chat, IA no PDF, WhatsApp automático | Autoria e inteligência permanecem no ambiente de desenvolvimento. |
| Arquivo PDF permanente em Storage | Gerar sob demanda no navegador como na 10xMidia. |
| Taxonomia, busca avançada, paginação editorial elaborada, associação a várias fontes | Uma lista ordenada e uma fonte opcional bastam para o piloto. |
| Pacote compartilhado entre produtos ou refatoração da 10xMidia | Adaptação local na Vote Melhor. |

## Entrada mínima e rotina da skill

**Sem YAML/frontmatter obrigatório neste piloto.** Receber um Markdown e poucos metadados por argumentos do script; evita construir um importador editorial antes de validar a ideia.

```bash
node backend/scripts/push-dossier.mjs /caminho/privado/senado.md \
  --slug integracao-senado \
  --title "Como acessamos os dados do Senado" \
  --source-id senado-receitas-proprias \
  --code-commit <sha-completo> \
  --dry-run
```

O envio usa o mesmo comando sem `--dry-run`. `API_URL` e `BEARER_TOKEN` vêm do ambiente privado; não imprimir, versionar ou passar token em argumento. Usar Node 22, coerente com os Dockerfiles e o Supabase do lockfile. Não criar pacote distribuível nem instalar o CLI globalmente: o script roda do checkout.

Payload: `{ title, markdown, sourceId, codeCommit }`; slug vem da URL. `sourceId` pode ser null; o repositório do código é a Vote Melhor, fixo no piloto. Título e SHA obrigatórios. Resumo, período dos dados, mapa de arquivos e referências vivem no Markdown, sem campos/entidades paralelos.

A skill:

1. Resolve o SHA-base, lê a implementação nesse SHA, commits e diffs pertinentes, planos e testes. Valida que os caminhos do mapa existem naquele commit.
2. Escreve abertura acessível e detalhes técnicos no mesmo documento; referencia fontes oficiais e links GitHub fixados no SHA.
3. Distingue código observado, medições históricas, testes executados, hipóteses e lacunas. Não transforma comentários de código em fatos sobre o órgão.
4. Se houver alterações locais relevantes, analisa somente o snapshot commitado ou aguarda um commit para incluir essas alterações. Não atribui mudanças locais ao SHA nem publica o diff bruto.
5. Guarda o rascunho em local privado fora do checkout público. Revisar a inclusão futura no GitHub separadamente da publicação na plataforma.
6. Executa dry-run, envia se solicitado e devolve o link da prévia. Não publica pelo script e não executa comandos sugeridos pelo conteúdo analisado.

Uma única skill em `.claude/skills/dossies/SKILL.md`, legível por Claude/Codex, aponta para o mesmo script. Sem cópias divergentes por ferramenta.

### Validação suficiente

Script valida flags, leitura, conteúdo não vazio, UTF-8, tamanho e SHA/caminhos locais. API revalida o payload inteiro; não confia no script. Título até 160 caracteres, Markdown até 128 KiB, slug de 3–80 caracteres minúsculos/hífens, SHA de 40 hex, `sourceId` existente em `DataCatalogModel` quando fornecido. Recusar campos extras de publicação, autoria e permissões.

Permitir títulos, parágrafos, listas, tabelas, links e código cercado; ASCII usa bloco `text`. Desativar HTML/MDX executável. Não suportar imagens/anexos no piloto. Links somente HTTPS e âncoras válidas; bloquear esquemas executáveis e URLs com credenciais. Não buscar links arbitrários pelo servidor. Validar fontes e sensibilidade editorialmente antes de publicar.

## API e acesso — reaproveitar o existente

| Operação | Acesso | Resultado |
|---|---|---|
| `PUT /dossiers/:slug/draft` | Supabase JWT de autor autorizado e conta ativa | Cria identidade ou substitui só o rascunho; devolve ID e endereço administrativo. |
| `GET /dossiers/admin` | JWT + `requireAdmin` | Lista recebidos para conferência. |
| `GET /dossiers/admin/:slug` | JWT + `requireAdmin` | Rascunho e situação atual da publicação. |
| `POST /dossiers/admin/:slug/publish` | JWT + `requireAdmin` | Publica o conteúdo que o administrador acabou de conferir. |
| `GET /dossiers` | Público | Lista apenas cópias publicadas, sem corpo dos documentos. |
| `GET /dossiers/:slug` | Público | Somente cópia publicada; 404 se não publicada. |

Preservar envelope `sendOk`/`sendError` e `apiClient`. A Vote Melhor usa rotas sem `/api`. Reservar slug `admin`, registrar rotas administrativas antes de `/:slug`. Administração recebe `Cache-Control: no-store`; não colocar rascunhos em resposta pública ou cache público.

Para o piloto, permitir envio apenas ao UUID de um usuário autor configurado em `DOSSIER_AUTHOR_USER_ID`; ele tem papel normal `user`, não `admin`. Reusar `supabaseMiddleware` e comparar esse ID no handler. O humano publica com a conta admin. Provisionamento usa o Auth existente; sem tela de tokens e sem service role no script. Não sugerir que JWT de administrador seja uma credencial limitada a upload.

Uma conta comum arbitrária não pode importar. A sessão do autor não pode publicar; a API nunca deriva permissões do Markdown. Essa separação é pequena e mantém o requisito original de menor privilégio.

Limite JSON específico de 1 MiB na rota de envio, considerando escapes; montar o parser antes do `express.json()` global que hoje usa limite padrão. Classificar JSON inválido como 400, tamanho como 413, token como 401, permissão como 403, conteúdo inválido como 422. Timeout/rede devem resultar em erro visível e exit code não zero, sem dump de token/body. Nenhuma fila ou retry permanente.

Reenvio usa o mesmo slug e nunca cria documentos duplicados. O último envio autorizado substitui o rascunho; não há merge ou detecção de conflito entre autores. Tentativa concorrente de criar o mesmo slug trata unique violation e repete a leitura, sem duplicar a linha.

**Única proteção de concorrência mantida:** publicar exige o `draft_updated_at` que a tela conferiu. Se houve outro envio, retorna 409 e pede recarregar. Não é histórico/versionamento: evita que um clique publique texto que a pessoa não viu. O Model lê o rascunho e faz uma única atualização condicional de `published`, `published_at` e `published_by`, filtrando também pelo timestamp esperado; se não atualizou linha, não declarar sucesso. Usar timestamp do banco preservado como string, sem perder precisão em conversões JavaScript.

## Banco / DDL — uma tabela

Estado: **previsto, não aplicado**. A consulta de metadados pelo conector foi negada; confirmar schema/grants de `users` antes da implementação, sem presumir o estado remoto.

```text
public.dossiers [N]
  id                 uuid PK DEFAULT gen_random_uuid()
  slug               text NOT NULL UNIQUE
  draft              jsonb NOT NULL
  published          jsonb NULL
  submitted_by       uuid NOT NULL REFERENCES public.users(id)
  created_at         timestamptz NOT NULL DEFAULT now()
  draft_updated_at   timestamptz NOT NULL DEFAULT clock_timestamp()
  published_at       timestamptz NULL
  published_by       uuid NULL REFERENCES public.users(id)

JSON de draft/published:
  { title: string, markdown: string, sourceId: string|null, codeCommit: string }

Índices: UNIQUE(slug); submitted_by; published_by;
         published_at DESC WHERE published IS NOT NULL.
Constraints: JSON objeto e campos/tipos/tamanho válidos; slug válido;
             published/published_at/published_by juntos nulos ou preenchidos.
FKs: ON DELETE RESTRICT; sem cascata que apague documentos.
Trigger: atualiza draft_updated_at quando draft muda; publicação não muda essa data.
RLS: habilitada; sem policies/grants para anon e authenticated.
Client: service role já existente, somente dentro do backend.
Realtime/Storage: não usados. Tabela users: preservada.
Aplicação: Management API em transação; sem migration .sql no repositório.
```

A API pública projeta explicitamente `slug`, `published` e `published_at`. Nunca faz `select('*')` e devolve a linha. Título, fonte e Markdown públicos vêm de `published`; usar `draft.title` no card vazaria conteúdo ainda não aprovado. O service role ignora RLS, por isso os testes de projeção da API são obrigatórios.

Não criar tabelas de credenciais, revisão ou aprovação e não criar RPCs para esse piloto. Publicação é um UPDATE atômico dos três campos. Antes de produção, conferir constraints, índices, grants e RLS com leitura de metadados e anon/JWT real; sucesso com service role não prova isolamento. Rollback inicial: transação; depois de receber documentos: desabilitar rotas preservando a tabela, sem apagar dados.

## Interface e PDF — mantidos

Biblioteca `/dossies`: lista simples dos publicados, título, fonte, data e link. Leitura `/dossies/:slug`: título, conteúdo, fontes, código e botão Exportar PDF. Administração `/admin/dossies`: recebidos; detalhe `/admin/dossies/:slug`: mesma leitura, identificação clara de rascunho, mesmo exportador e botão Publicar.

Seguir as páginas públicas com sidebar já existentes na Vote Melhor, com `isPublicPath` liberando apenas `/dossies` e `/dossies/`. `/admin/dossies` continua protegida; adicionar teste de fronteira de prefixo. O guard real é a API. Uma consulta da biblioteca filtrada por `sourceId` atende ao link no conjunto do Senado, sem alterar o modelo do catálogo.

| Da 10xMidia | Adaptação necessária |
|---|---|
| `ReportPdfExport.tsx` | Manter modal, import dinâmico sem SSR, loading, retry e download; trocar modelo/títulos. |
| `ReportPdfPreview.tsx` | Manter PDF.js, worker, todas as páginas, resize/lazy render/cancelamento; retirar reporter específico da 10xMidia. |
| `ReportPdfRenderer.tsx` | Manter `usePDF`, Blob/URL e paginação. Substituir seções de marketing por conteúdo Markdown; não usar `cleanSummary`. |
| `frontend/lib/reportPdf.ts` | Tipos pequenos e nome de arquivo para dossiê; sem métricas, períodos de campanha ou revisões. |
| `ui/dialog` | Adaptar wrapper, pois a Vote Melhor tem Radix instalado, mas não esse arquivo. |

Copiar essas peças não exige levar ReportView, ChatPanel, campanhas, billing ou Sentry. A matriz detalhada e as versões estão no diagnóstico. A autorização de reutilização do código privado precisa ser registrada; não foi encontrado LICENSE geral que a comprove. Sem autorização de cópia, implementar os mesmos comportamentos a partir de requisitos e bibliotecas públicas.

**Markdown e fidelidade:** interpretar o Markdown na interface por uma função pequena, usando parser existente de Markdown/GFM e sua árvore nativa; alimentar os adaptadores web e PDF com o mesmo conteúdo e regras. Sem AST no banco, framework editorial ou formato próprio de blocos. O adaptador PDF usa `Text`, `View` e `Link`: HTML não funciona diretamente no react-pdf. Esse adaptador é trabalho real, mesmo com a infraestrutura de PDF já pronta.

- Títulos/ênfase/listas/tabelas devem conservar todo o texto. Código/ASCII em fonte monoespaçada, preservando espaços.
- No piloto, limitar editorialmente diagramas a uma largura legível em A4; se não couber, mostrar erro e pedir reorganização do Markdown. Não cortar nem reduzir a fonte indefinidamente. Validar largura com a fonte efetiva, não só número de caracteres.
- Código alto divide por linhas; tabelas longas dividem por linhas com cabeçalho repetido. Célula/diagrama que não caiba exige erro claro ou divisão editorial explícita, nunca perda silenciosa.
- Escolher fontes TTF estáticas com licença redistribuível e verificar acentos e box-drawing. Não copiar assets privados de marca. Não presumir que Helvetica suporte todos os diagramas.
- Identificar título, endereço público, data de publicação e SHA do código no PDF; rascunho recebe “RASCUNHO”. Nome de arquivo inclui slug e data; sem número de revisão.
- Prévia e download usam o mesmo Blob. Ao mudar o conteúdo, invalidar o Blob anterior e impedir resultado atrasado de reabilitar download antigo; desmontar/remontar o renderer por identidade do conteúdo carregado.
- PDF textual, com seleção de texto e links. Canvas é somente a prévia. Exportação não chama IA nem fontes governamentais.

## Fases e arquivos

Legenda: **N** novo proposto; **M** existente a alterar; **B** existente reaproveitado. Os arquivos ainda não foram criados, salvo os planos. A organização em arquivos de rota/controller/model segue a convenção local; não representa serviços novos.

| Fase | Objetivo e contrato | Arquivos a criar/alterar | Reaproveitamento/dependências | Testes e validação | Commit sugerido |
|---|---|---|---|---|---|
| 0. Plano e piloto local | Fechar recorte e escrever um dossiê curto do Senado; fatos sempre com evidência | Planos [M]; Markdown fora do checkout [N privado] | Investigação TLS e `officialHttpGet`; diagnóstico concluído | Conferir fontes, SHA, mapa e legibilidade para os dois públicos; ainda sem upload | `docs(dossies): define piloto mínimo e evidências` |
| 1. Envio e banco | Um slug, um rascunho; envio nunca publica | `backend/scripts/push-dossier.mjs` [N], `.claude/skills/dossies/SKILL.md` [N], `backend/src/routes/dossierRoutes.ts` [N], `controllers/DossierController.ts` [N], `models/DossierModel.ts` [N], `types/dossier.ts` [N], `backend/src/index.ts` [M], `middleware/errorHandler.ts` [M] | `supabaseMiddleware.ts:29`, `requireRole.ts:27`, `apiResponse.ts:20`, client Supabase; padrão do script 10xdev. DDL desta fase: tabela acima | Dry-run sem rede; importação/atualização; token inválido; usuário não autorizado; campos de publicação recusados; isolamento; falha após persistir seguida de reenvio | `feat(dossies): backend - recebe e publica dossiês simples` |
| 2. Leitura e PDF | Conferir/publicar e exportar exatamente o conteúdo aberto | `frontend/app/(dashboard)/dossies/page.tsx` e `[slug]/page.tsx` [N], `app/(dashboard)/admin/dossies/page.tsx` e `[slug]/page.tsx` [N]; `components/dossiers/DossierContent.tsx`, `DossierPdfExport.tsx`, `DossierPdfPreview.tsx`, `DossierPdfRenderer.tsx` [N]; `components/ui/dialog.tsx` [N]; `services/dossierService.ts`, `types/dossier.ts`, `lib/dossierMarkdown.ts`, `lib/dossierPdf.ts` [N]; manifests/lockfile [M] | `apiClient`, auth, botão local; os quatro módulos PDF da 10xMidia. Sem DDL adicional | Conteúdo privado/público; publicação com tela desatualizada; Markdown/web/PDF; loading/erro/retry; todas as páginas do PDF inspecionadas | `feat(dossies): frontend - adiciona leitura revisão e pdf` |
| 3. Integração e aceite | Completar fluxo do Senado dentro do produto | `frontend/lib/publicRoutes.ts`, `components/AppSidebar.tsx`, `app/(dashboard)/fonte-de-dados/FonteDeDadosView.tsx` [M]; testes abaixo [N/M]; plano [M] | `DataCatalogModel` IDs e navegação existentes; fases 1–2 | Fluxo real completo, link na fonte, visitante sem rascunhos e PDF compartilhável | `feat(dossies): integração - conecta biblioteca às fontes` |

Dentro de cada fase, organizar commits por grupos do mapa conforme a skill local de commits: rotas/controllers, models/types, componentes, services/lib/types, testes e documentação. Os títulos acima descrevem entregas; dividir em commits de arquivos inteiros quando necessário. Não criar commits agora. Aplicação de DDL deve ser registrada no plano, sem commit vazio.

O número de arquivos excede o alerta de oito arquivos da `/plan-eng-review`: o principal custo restante é UI/PDF, expressamente mantido pelo usuário, e a separação convencional do projeto. Não criar camada Service, framework de importação ou biblioteca compartilhada para reduzir artificialmente responsabilidade por arquivo.

## Revisão de engenharia: testes e falhas

```text
arquivo + argumentos
  +-- inválido / grande / SHA errado --> erro local [T1]
  +-- dry-run ------------------------> nenhuma rede [T1]
  +-- envio --> JWT/autor inválido ----> 401/403 [T2]
             --> documento inválido --> 400/413/422 [T2]
             --> grava rascunho ------> URL privada [T2]
                    +-- reenvio -----> mesmo slug, sem duplicar [T2]

admin abre rascunho --> conteúdo + PDF [T3/T4]
  +-- sem permissão -----------------> acesso negado [T2/T3]
  +-- rascunho mudou antes do clique -> 409, recarregar [T2/T3]
  +-- publica -----------------------> copia o conteúdo conferido [T2]

visitante --> lista/detalhe
  +-- sem publicação ----------------> ausente / 404 [T2/T3]
  +-- publicado ---------------------> somente cópia pública [T2/T3]
                           |
                           +--> gerar PDF
                                +-- erro --> retry [T4]
                                +-- mudou conteúdo --> invalida download [T4]
                                +-- pronto --> mesmo Blob na prévia/download [T4]
```

| Teste proposto | Cobertura e falha real | Tratamento/resultado esperado |
|---|---|---|
| T1 `backend/scripts/push-dossier.test.mjs` (Node test runner) | Leitura/flags inválidas, UTF-8/tamanho, dry-run, timeout/401, resposta inesperada | Erro legível, saída não zero, nenhum token ou conteúdo sensível no log. |
| T2 `backend/src/tests/dossierController.test.ts` e `dossierModel.test.ts` | Autorização, payload forjado, publicação pelo autor, publicação concorrente, duplicate slug, erro de banco | Não publicar nem vazar rascunho; reenvio sem duplicata; 409 sem alteração parcial; falha não vira lista vazia. |
| T3 `frontend/tests/dossierView.test.tsx` + `publicRoutes.test.ts` [M] | Vazio/carregamento/erro, público/admin, ação Publicar, links e fonte | Estados claros; rota administrativa não aberta por prefixo; nenhuma edição local silenciosa. |
| T4 `frontend/tests/dossierPdf.test.tsx` e `dossierMarkdown.test.ts` | Tokens/células/linhas completos, caracteres, links, troca de conteúdo, falha do chunk, geração e retry | Download bloqueado até Blob atual; nenhuma omissão; erro de layout orienta revisão do documento. |
| Integração com banco de teste | Grants/RLS, JWT comum/autor/admin, trigger de timestamp, cópia publicada | Provar acesso direto negado e fronteiras da API; mocks sozinhos não comprovam RLS. |
| Inspeção visual do PDF real | Tabela multipágina, ASCII largo/alto, código, acentos, links e rodapé | Conferir todas as páginas, primeira/última linha de cada bloco, texto selecionável e links; testes de componentes não bastam. |

Executar Jest somente por arquivo e `--runInBand`, sequencialmente. `typecheck`, `lint` e build ficam com o desenvolvedor conforme `.claude/CLAUDE.md`; não rodar suíte completa. Como as dependências de PDF serão novas, incluir build frontend com worker na validação da implementação.

**Qualidade:** manter DTO público explícito; um renderizador Markdown utilizado pelas duas telas; script sem engine genérico; sem editor paralelo. **Performance:** limites pequenos, listagem sem corpos, PDF carregado sob demanda e preview lazy já existente. Não adicionar cache/fila sem medição. Diagrama curto deve acompanhar o Model no ponto em que rascunho vira público, para impedir regressão na fronteira.

## Piloto do Senado e evidências

Título: **Como a Vote Melhor acessa os dados do Senado — e o que aprendemos quando a conexão falhou.**

1. Em poucas palavras: tornar arquivos e dados legislativos oficiais consultáveis; explicar o benefício sem exigir conhecimento de TLS.
2. Origem: catálogo financeiro/Arquimedes e API legislativa são caminhos diferentes; citar URLs oficiais próximas das afirmações.
3. Percurso real: diagrama abaixo e mapa dos arquivos; não adicionar banco/índice semântico à ingestão porque constavam da visão de produto.
4. Dificuldade: investigação histórica registrou timeout do Node e sucesso com TLS limitado por host. Explicar que a característica específica do ClientHello não foi isolada.
5. Solução: transporte centralizado, TLS por host e redirects. Evidenciar pelo código e diff, sem acusar o órgão de não suportar TLS 1.3.
6. Guia técnico: arquivos, teste reproduzível, resultados da análise e limites; concluir com como contribuir.

```text
Arquivos do catálogo --> officialHttpGet --> fetchSourceFile
  --> DataCatalogController/parseSpreadsheet --> /data-sources --> FonteDeDadosView

API legislativa --> officialHttpGet --> fetchSenado (cache em memória de 1 hora)
  --> normalização / SenatorModel / VotacaoModel
  --> /senators e /votacoes --> tela Senado
```

Fontes internas confirmadas:

- `.cursor/plans/fazendo/fonte-de-dados/investigacao-tls-senado.md`: medições históricas e ressalvas, não experimentos repetidos hoje.
- `backend/src/utils/officialHttpGet.ts`: `node:https`, três hosts com `maxVersion: TLSv1.2`, até cinco redirects; não desabilita validação de certificado.
- `backend/src/utils/fetchSourceFile.ts`, `fetchSenado.ts`, `normalizeSenadoVote.ts`; Models/Controller/telas do diagrama.
- Commit `7eac1b5e9a1ae921e77b34219b9a67279359eeb7`: diff centraliza transporte e migra mocks para `node:https`.
- Commit `dfc19969d39dc170c63c5678bd628735d20b5594`: registro da investigação; `90afc64443ee10063c2c81c0c32860b278121691`: correção da URL do repositório no User-Agent.
- Base da análise Vote Melhor: `36f34316a6041ab0bb09e343b545bf6669b99ad5`; caminhos do dossiê devem apontar para esse SHA se esse for o recorte escolhido.

**Executado nesta análise:** `npm test -w backend -- --runInBand src/tests/fetchSourceFile.test.ts src/tests/fetchSenadoProcess.test.ts src/tests/fetchSenado.test.ts`: **3 suites, 12 testes passaram**. HTTPS foi mockado; isso comprova os cenários unitários, não o handshake atual da origem. Não foram executados testes da biblioteca de dossiês, geração/inspeção de PDF ou E2E, pois ainda não há implementação.

**Lacunas do piloto:** reconferir links oficiais ao escrever o texto final; novas medições TLS somente se necessárias, registrando ambiente/data; revisar generalizações históricas como “não era ambiente” e “é daquele balanceador”, cuja causa exata não foi isolada. Datas de publicação, commit e período dos dados devem aparecer separadamente no texto.

## Critério de aceite e pendências

Aceite: agente escreve o piloto → script envia → humano abre o rascunho e confere o PDF → publica → visitante lê e baixa o PDF → humano compartilha manualmente. Reenvio altera apenas rascunho. Nenhum passo requer cópia manual do texto para a plataforma.

| Pendência | Caminho recomendado |
|---|---|
| Metadados remotos indisponíveis pelo conector | Inventário read-only autorizado antes de DDL; não criar objetos sobre nomes desconhecidos. |
| Permissão para copiar componentes privados | Registrar autorização/licença dos arquivos; o mesmo titular dos produtos não foi presumido como prova documental. |
| Fonte e paginação para ASCII/tabelas | Provar no piloto, inspecionando todas as páginas; bloquear exportação inválida, nunca cortar. |
| Sessão de autor no script | Conta não-admin do Auth existente, UUID autorizado na configuração; token pela env; erro 401 orienta renovação. |
| Perda de conteúdo antigo | Aceita pelo escopo sem histórico; não prometer recuperação ou link permanente para PDFs antigos. |
| Rascunho no GitHub público | Manter fora do checkout até revisão; a plataforma privada não protege um arquivo commitado. |

Referências técnicas consultadas: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [fontes react-pdf](https://react-pdf.org/docs/v4/fonts), [paginação react-pdf](https://react-pdf.org/docs/v4/advanced/page-wrapping). A documentação fundamenta uso de grants/RLS, fontes e paginação; o comportamento específico dos componentes foi confirmado nos arquivos dos checkouts, não presumido da documentação.

## GSTACK REVIEW REPORT

Revisão solicitada com `/plan-eng-review`. Modo **SCOPE_REDUCED**: escopo reduzido explicitamente pelo usuário; PDF mantido explicitamente. Revisão de planejamento, sem afirmar validação da implementação.

| Área | Resultado |
|---|---|
| Step 0 — escopo | Removidos histórico, auth própria, RPCs, AST persistida e infraestrutura de importação. Padrão real da skill 10xdev confirmado. |
| Arquitetura | Dois pontos tratados: não confundir gravação via API com direta no banco; impedir publicação de conteúdo diferente do conferido. |
| Qualidade | Dois pontos tratados: projeção pública não pode usar rascunho; renderer de marketing precisa de adaptação de Markdown. |
| Testes | Diagrama produzido; três lacunas de evidência registradas: banco real, layout do PDF e E2E da feature. |
| Performance | Um ponto tratado: PDF e worker sob demanda, sem carregar corpos na biblioteca. |
| Fora do escopo / reúso | Documentados. |
| TODOS.md | Nenhum item proposto; itens retirados são possibilidades futuras, não backlog obrigatório do piloto. |
| Outside voice | Não executada; sem segunda revisão independente. |
| Falhas silenciosas | Caminhos de falha e tratamento planejados na matriz; nenhuma implementação validada. |

**STATUS: DONE_WITH_CONCERNS.** Plano mínimo definido. Pendências de execução: inventário do banco, autorização de reúso e prova visual do renderer adaptado. Não há aprovação de deploy, publicação de conteúdo ou DDL nesta entrega. Logs/configuração/telemetria globais do gstack não foram alterados; o registro desta revisão está neste arquivo.
