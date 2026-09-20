---
name: diagnostico-dossies
overview: Evidências dos repositórios inspecionados; separadas do plano mínimo para consulta.
todos: []
isProject: false
---

# Diagnóstico de reaproveitamento dos dossiês

Inspeção em 20/09/2026. Este arquivo registra fatos e possibilidades de reúso; o escopo vigente está em [implementacao-dossies.plan.md](implementacao-dossies.plan.md). A matriz de capacidades não é uma lista de entregas obrigatórias do piloto.

## Diagnóstico baseado nos checkouts

### Recorte e grau de confirmação

| Projeto | Checkout e commit analisado | Estado observado |
|---|---|---|
| Vote Melhor | `/home/bertucci/code/vote-melhor`, `36f34316a6041ab0bb09e343b545bf6669b99ad5` | Código versionado sem modificações locais no início; pasta do briefing não rastreada. |
| 10xMidia | `/home/bertucci/code/10x-mkt`, `e73066498fb3887866033fc5bdca4ce5090e38f3` | `git status --short` vazio no início. |

Não foi feito fetch de branches remotas; o diagnóstico descreve esses checkouts, não garante equivalência com produção. Nenhuma credencial foi incluída neste plano.

Foram lidos: `.claude/CLAUDE.md` dos dois projetos; `AGENTS.md`, `CLAUDE.md` e os equivalentes de `frontend/` da 10xMidia; regras de commit e templates de plano da Vote Melhor; planos de acesso público, exportação e investigações do Senado; skills locais de busca aprofundada e Supabase, além das orientações de PostgreSQL. Na Vote Melhor não foi encontrado `AGENTS.md` próprio da raiz; `.agents/` e `.codex/` estão vazios neste checkout.

Os grafos `graphify-out/` foram consultados por símbolos e arestas, com confirmação nos arquivos reais. Estão atrás do HEAD: Vote Melhor declara base `c9b5004b`, 10xMidia `8036a6c8`. A ausência de `officialHttpGet` no grafo antigo da Vote Melhor não prova ausência no código. Nenhum grafo foi regenerado.

### Versões: declaração versus lockfile

| Tecnologia | Vote Melhor: manifest / lock | 10xMidia: manifest / lock | Consequência |
|---|---|---|---|
| Next.js | `^16.2.9` / `16.3.0` | `16.3.2` / `16.3.2` | App Router compatível em princípio; confirmar build e worker PDF.js na versão da Vote Melhor. |
| React / React DOM | `19.2.3` / `19.2.3` | `19.2.3` / `19.2.3` | Mesma base para os componentes. |
| TypeScript | backend `^5.9.3`, frontend `^5` / `5.9.3` | mesmo / `5.9.3` | Backend da Vote Melhor é CommonJS com verificações estritas. |
| Express | `^5.2.1` / `5.2.1` | `^5.2.1` / `5.2.1` | Preservar padrão Routes → Controller → Model. |
| Supabase JS | backend `^2.99.1`, frontend `^2.108.1` / `2.112.2` | `2.109.0` / `2.109.0` | Não transportar clients ou configuração do outro produto. |
| Supabase SSR | `^0.10.3` / `0.10.3` | `^0.9.0` / `0.9.0` | Reusar auth local. |
| Tailwind | `^3.4.17` / `3.4.19` | `^3.4.17` / `3.4.19` | Estilos adaptáveis; não pressupor tokens/variantes iguais. |
| PDF | não declarado | renderer `4.9.0`, PDF.js `5.4.624`, fixados e iguais no lock | Instalação nova na Vote Melhor, com lockfile. |
| Markdown | não declarado | `react-markdown` `10.1.0`, `remark-gfm` `4.0.1` no lock | Padrão visual útil, não parser pronto de dossiê. |
| Testes | Jest `29.7.0`; backend ts-jest, frontend next/jest + Testing Library | mesmos runners, configurações diferentes | Não copiar setup de testes sem adaptação. |

O Node desta sessão é `20.19.5`; os Dockerfiles atuais da Vote Melhor usam `node:22-alpine`. O Supabase `2.112.2` do lock exige Node `>=22`; portanto, alinhar o ambiente local a Node 22 antes dos testes de integração do novo domínio. A investigação histórica cita `node:20-alpine`, mas isso não descreve mais os Dockerfiles atuais. Não houve instalação/atualização de dependências nesta análise.

### Vote Melhor

| Capacidade | Evidência existente | Diagnóstico |
|---|---|---|
| API | `backend/src/index.ts:24`, routers em `backend/src/routes/`, `utils/apiResponse.ts:20` | Rotas `/users`, `/data-sources`, `/senators`, `/votacoes` etc., sem prefixo `/api`. Envelope `{ success, data/error }`. |
| Autenticação | `middleware/supabaseMiddleware.ts:29`, `requireRole.ts:12`, `types/user.ts` | Bearer Supabase validado com `getUser`; perfil `users`; conta deve estar ativa; papéis reais `user` e `admin`. `editor` aparece apenas em exemplo de comentário. |
| Persistência | `database/supabase.ts:7`, `models/UserModel.ts:21` | Client lazy de service role, que ignora RLS. Nas buscas de `.from`/`.rpc` em `backend/src`, a persistência encontrada é `users`; os dados do Senado são consultados na origem, com cache em memória no cliente da API. |
| DDL | `.claude/CLAUDE.md`, `.claude/skills/supabase/operacao.md` | Convenção local: Management API, sem migrations `.sql` versionadas. DDL futuro fica especificado e registrado no plano. |
| Catálogo | `models/DataCatalogModel.ts:377`, `types/dataCatalog.ts` | Catálogo estático de `Dataset` → `DatasetEdition` → `DataFile`. Não presumir tabela de fontes. IDs úteis: `senado-receitas-proprias`, `senado-dotacao-e-despesas`, `senado-demonstracoes-contabeis`. |
| Páginas públicas | `frontend/lib/publicRoutes.ts:4`, `proxy.ts`, `(dashboard)/layout.tsx` | `/inicio`, `/senado`, `/camara`, `/fonte-de-dados` são públicas com sidebar. O comentário antigo que equipara dashboard a área privada está defasado. |
| Transporte frontend | `frontend/services/apiClient.ts`, `lib/apiBase.ts` | Base por ambiente, envelope desembrulhado uma vez, timeout e refresh de sessão. Reusar em `dossierService`; não espalhar fetch. |
| UI | `components/ui/button.tsx`, `components/showcase/blocks/ConfirmDialog.tsx` | Radix Dialog está instalado; `components/ui/dialog.tsx` não existe. Criar wrapper local acessível, sem copiar o showcase como formulário administrativo completo. |
| Dossiês / Markdown / PDF / chave de importação | busca por `dossier`, `dossi`, `react-markdown`, `agent`, `pdf` em frontend/backend e manifests | Não encontrados como funcionalidades do produto no código inspecionado. PDF citado como fonte oficial não equivale a exportador. Criar domínio e autenticação de importação. |

**Banco remoto não confirmado:** uma consulta somente de definições (`information_schema`, constraints, policies e grants), dirigida ao projeto identificado na configuração local, foi negada pelo conector Supabase: `You do not have permission to perform this action`. Não se conclui que tabelas/policies estejam ausentes ou corretas. Antes da fase 2, repetir inventário por um acesso de leitura autorizado, incluindo `users`, schemas expostos, funções, grants, índices e publicações. Não houve DDL ou leitura de dados pessoais.

### 10xMidia

Frontend Next/React e backend Express/Supabase também usam npm workspaces. Os domínios e a autenticação de produto são maiores: projetos/membros, métricas, relatórios, billing e chat. `backend/src/models/reportModel.ts`, `controllers/reportController.ts`, `frontend/services/reportService.ts` e o `ReportView` mostram o acoplamento a relatórios persistidos e projetos; esse modelo não serve como persistência editorial.

O caminho de exportação efetivamente termina no navegador: `ReportView.tsx:1264` monta `ReportPdfModel`; `ReportActions` abre o modal; `ReportPdfRenderer` usa `usePDF`; `ReportPdfPreview` usa PDF.js para mostrar todas as páginas numa rolagem. Não é paginação por botões nem iframe, apesar de textos antigos do plano e de um teste ainda mencionarem iframe. O documento atual também não inclui o gráfico previsto no plano antigo.

`backend/src/routes/agent.ts` contém somente GETs. `agentKeyMiddleware.ts` usa `X-Agent-Key`, e `agentKeyModel.ts` consulta o token diretamente em `agent_keys`. A regra explícita proíbe mutations nesse namespace. Não reutilizar essa chave, tabela ou rota para o envio de dossiês, nem copiar armazenamento de token em claro.

### Matriz de reaproveitamento

Todos os caminhos desta tabela são existentes na 10xMidia, relativos à raiz daquele checkout.

| Peça | Classificação | Dependências e decisão |
|---|---|---|
| `frontend/components/ReportPdfExport.tsx` | **Adaptar** | Bom mecanismo: dynamic import sem SSR, ErrorBoundary, retry, estado identificado por fingerprint, download do Blob atual. Trocar `ReportPdfModel`, título/período, marca e wrapper `ui/dialog`; usar identidade forte de revisão. |
| `frontend/components/ReportPdfPreview.tsx` | **Reutilizar com poucas alterações** | PDF.js, worker via `new URL`, ResizeObserver, IntersectionObserver, cancelamento de render e destroy do loading task. Substituir `reportErrorFront` (Sentry do outro produto); corrigir proporção fixa de A4 retrato caso futura orientação alternativa entre no escopo. |
| `frontend/components/ReportPdfRenderer.tsx` | **Usar apenas como referência** | `usePDF`, ciclo de atualização e documento textual são úteis. Layout/KPIs/campanhas não servem; `cleanSummary` remove marcação de títulos e ênfase, sem interpretar tabelas/código. `experimentalPagination` e `Page.layout` exigem validação da versão fixa. Criar `DossierPdfRenderer`. |
| `frontend/lib/reportPdf.ts` | **Adaptar** | Reaproveitar ideia de tipos de estado, nome seguro e invalidação; descartar KPIs, categorias e datas de campanha. Fingerprint atual é FNV de 32 bits, inadequado como hash de integridade. SHA-256 vem do servidor. |
| `frontend/components/ReportActions.tsx` | **Reutilizar com poucas alterações** | Wrapper pequeno para ações; pode virar composição direta em `DossierView`, sem componente adicional só para um botão. |
| `frontend/components/ReportView.tsx` | **Usar apenas como referência** | ReactMarkdown + remark-gfm nas análises, mas componente agrega métricas, estado de projeto, presets, realtime e chat. Não copiar página nem construção de modelo. |
| `frontend/components/ChatPanel.tsx` | **Usar apenas como referência; fora do MVP** | API por props, mas importa ProjectChatContext, anexos, tipos de mensagens, gráficos e outros componentes. Não é pré-requisito de autoria pelo Cursor. |
| `frontend/tests/reportPdfExport.test.tsx` e `reportPdfPreview.test.tsx` | **Adaptar** | Casos de carregamento, mudança de modelo, erro, retry e páginas. Adaptar convenção de globals/mocks da Vote Melhor. |
| `frontend/tests/reportPdfDocument.test.tsx` e `reportPdfIntegration.test.tsx` | **Usar apenas como referência** | Documento testa primitivas mockadas e presença de campanhas, não paginação física. Integração cobre modelo de marketing. Não comprovam fidelidade de dossiês. |
| Contrato, parser/AST, importador, tabelas, API, revisão, biblioteca, vínculos a fontes, rotina editorial | **Criar** | Buscas acima não localizaram mecanismos equivalentes na Vote Melhor; os relatórios e `/api/agent` da 10xMidia não oferecem contrato editorial nem escrita restrita. |

**Licença e autorização:** não foi encontrado LICENSE/COPYING geral nos dois repositórios. O campo `ISC` em `backend/package.json` não comprova licença dos componentes privados do frontend. O lock da 10xMidia declara MIT para renderer/react-markdown/remark-gfm e Apache-2.0 para PDF.js; licenças dessas dependências não autorizam cópia do código proprietário. Antes de copiar, registrar autorização dos titulares, arquivos/commit autorizados e avisos exigidos. Sem isso, implementar os comportamentos a partir dos requisitos e documentação pública, sem transportar código, testes textuais, marca ou assets privados. Esclarecer também a licença geral da Vote Melhor antes da distribuição desse material como código aberto.

