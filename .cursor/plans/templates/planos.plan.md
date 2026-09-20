---
name: <NOME_DO_PLANO>
overview: <RESUMO_EM_1_2_LINHAS>
todos: []
isProject: false
---

# `<TITULO_DO_PLANO>`

---

## Problema

`<DOR_OU_LIMITACAO_ATUAL>`

---

## Solucao

`<DIRECAO_ESCOLHIDA_E_O_QUE_MUDA>`

---

## Diagrama: estado atual vs. desejado

> Se for **feature nova** (sem estado atual), mantenha apenas a secao "Desejado".
>
> **Regra obrigatoria para banco:** sempre que o plano criar ou alterar estrutura no banco, o diagrama deve mostrar um no explicito `Banco / DDL` com tabela afetada, colunas e tipos/nullability/defaults, constraints, indices, RLS/policies/grants, publication/Realtime quando aplicavel e o metodo de aplicacao. Marque o que sera criado, alterado, removido ou apenas preservado; nao esconda DDL em texto generico como "ajustar schema".

### Atual

```text
<ENTRADA_OU_GATILHO>
     │
     ▼
<COMPONENTE_1>                 (existente — <observacao_se_relevante>)
     │
     ├─── <responsabilidade_1>                      ┐
     ├─── <responsabilidade_2>                      │ <PADRAO_PROBLEMATICO>
     └─── <responsabilidade_3>                      ┘
     │
     ▼
<COMPONENTE_FINAL>             (existente)
     │ <observacao_sobre_limitacao>
```

### Desejado

```text
Frontend: TagButton.tsx                         (existente — onClick agora chama hook novo)
     │
     │ POST /api/tags/:id/favorite
     ▼
backend/src/routes/tagRoutes.ts                 (existente — registra rotas novas)
     ├─ POST   /tags/:id/favorite → TagController.favorite
     └─ DELETE /tags/:id/favorite → TagController.unfavorite

backend/src/controllers/TagController.ts        (existente — ganha 2 handlers)
     │   └─ favorite(req, res)  ◄── handler novo (~30 linhas)
     │       1. valida tagId existe via TagModel.findById
     │       2. resolve userId via req.user
     │       3. chama TagFavoriteService.add()
     │       4. retorna 200 com { isFavorite: true, count }
     │
     │   └─ unfavorite(req, res)
     │       1. valida tagId
     │       2. chama TagFavoriteService.remove()
     │       3. retorna 200 com { isFavorite: false, count }
     │
     │ chama:
     ▼
backend/src/services/TagFavoriteService.ts      ✨ NOVO — orquestra favorito (~80 linhas)
         ├─ add(userId, tagId)
         │     ├─ se ja existe → retorna idempotente
         │     └─ se nao → insere via TagFavoriteModel + invalida cache
         │
         ├─ remove(userId, tagId)               idempotente
         ├─ listForUser(userId)                 retorna tags favoritas do user
         └─ countForTag(tagId)                  quantos users favoritaram (cacheado)

backend/src/models/TagFavoriteModel.ts          ✨ NOVO — acesso a tabela tag_favorites
         ├─ create({ userId, tagId })
         ├─ delete({ userId, tagId })
         ├─ existsForUser(userId, tagId)
         └─ countByTagId(tagId)
            (so consumido por TagFavoriteService; sem import circular)

backend/src/types/tag.ts                        (existente — ganha tipos)
         ├─ TagFavorite                          ◄── shape da tabela tag_favorites
         ├─ TagFavoriteResponse                  ◄── retorno do POST/DELETE
         └─ Tag (existente — ganha campo isFavorite?: boolean)

Supabase PostgreSQL — DDL via Management API       ✨ ALTERACAO ESTRUTURAL
         └─ CREATE TABLE public.tag_favorites
              ├─ user_id uuid NOT NULL
              ├─ tag_id uuid NOT NULL
              ├─ created_at timestamptz NOT NULL DEFAULT now()
              ├─ UNIQUE (user_id, tag_id)
              ├─ RLS ENABLED + policies: <listar operacoes e predicados>
              ├─ grants: <listar o que muda ou declarar preservados>
              └─ Realtime/publication: <entra, nao entra ou nao se aplica>
            Aplicacao: Supabase Management API; sem arquivo .sql no repo

     ┌─────────────────────────────────────────────────────────────────┐
     │ Endpoint novo: POST   /api/tags/:id/favorite                    │
     │                DELETE /api/tags/:id/favorite                    │
     │   body: vazio                                                   │
     │   resposta: { isFavorite: boolean, count: number }              │
     │                                                                 │
     │ Endpoint existente: GET /api/tags                               │
     │   contrato novo: cada Tag ganha campo `isFavorite?: boolean`    │
     │   (so quando autenticado; nao quebra clientes anonimos)         │
     └─────────────────────────────────────────────────────────────────┘

     ▼
frontend/components/TagButton.tsx               (existente — perde fetch local)
     │   ─ leitura: usa isFavorite vindo do GET /tags (campo novo)
     │   ─ click: chama useTagFavorite.toggle(tagId)
     │   sem fetch direto, sem re-render do feed inteiro
     │
     ├──► frontend/hooks/useTagFavorite.ts      ✨ NOVO — orquestra toggle no client
     │     ├─ toggle(tagId)                     optimistic update + rollback no erro
     │     ├─ isLoading(tagId)                  loading por-tag
     │     └─ subscribe(tagId, callback)        invalida lista quando muda
     │
     ├──► frontend/components/TagList.tsx       (existente — usa isFavorite)
     │     └─ ordena favoritos no topo
     │
     └──► frontend/components/TagSearch.tsx     (existente — sem mudanca estrutural)
          └─ comportamento de busca permanece
```

> Convencoes de notacao e dicas de uso: [diagrama-arquitetura.template.plan.md](./diagrama-arquitetura.template.plan.md).

---

## Mapa de arquivos

> **Parte obrigatoria do plano, logo abaixo do Diagrama e antes da Checklist resumida.** Repetir o titulo `Mapa de arquivos` dentro do ASCII para identificar o bloco quando copiado ou compartilhado.
>
> Agrupar por caminhos reais e responsabilidade: routes/controllers, services, models/types, components, hooks, services/lib e tests, conforme o escopo. Cada arquivo deve ter uma descricao curta do que faz ou passa a fazer; usar setas para mostrar as dependencias principais. Omitir grupos que nao participam da mudanca.
>
> **Formato aprovado:** blocos `BACKEND`, `SUPABASE / DDL` (quando aplicavel) e `FRONTEND`, com o caminho-base no titulo. Separar blocos com linhas de `=`; grupos com linhas de `-`; responsabilidades internas com `--- Nome ---`. Manter a mesma largura dos separadores e alinhar arquivo, contagem e responsabilidade para facilitar a leitura.
>
> **Contagens:** cada grupo de arquivos mostra quantidade de arquivos e total de linhas. Services e Hooks tambem mostram as linhas de cada arquivo; grupos compostos, como `Services + lib + types`, mostram subtotal por caminho e total combinado. Medir linhas fisicas dos arquivos atuais (ex.: `wc -l`), incluindo comentarios; identificar estimativas de arquivos ainda nao criados. Referencias por seta nao entram duas vezes na soma. Arquivos compartilhados fora do subtotal ficam explicitamente separados. Recalcular contagens apos alteracoes e nao copiar os placeholders do exemplo para um plano finalizado.
>
> **Supabase / DDL:** incluir sempre que a feature criar/alterar estrutura ou configuracao no banco, mesmo sem arquivos SQL no diff. Agrupar tabelas/colunas, RPCs, indices/constraints, RLS/policies/grants, Realtime e Storage conforme o escopo; nomear os objetos reais e resumir responsabilidades. Indicar criado/alterado/preservado e estado previsto/aplicado/conferido, com data quando verificado. Identificar aplicacao via Management API, sem migration `.sql`. O mapa resume o DDL detalhado no Diagrama e na fase; nao precisa duplicar o SQL. Omitir este bloco quando nao houver mudanca de banco.
>
> Legenda dos arquivos: `B` = existente reutilizado sem alteracao; `M` = modificado; `N` = novo; `R` = removido/substituido. No planejamento, indicar que os estados sao previstos; durante a execucao, atualizar conforme o realizado. Registrar consolidacoes e substituicoes. O mapa complementa os arquivos por fase e deve acompanhar as mudancas de escopo.

```text
Mapa de arquivos
================================================================================
BACKEND / backend/src/
================================================================================

Routes + controllers                       2 arquivos, <total> linhas
  routes/tagRoutes.ts [M]
    -> controllers/TagController.ts [M]      HTTP, acesso e resposta

--------------------------------------------------------------------------------
Services                                   1 arquivo, <total> linhas
  --- Favoritos ---
  TagFavoriteService.ts [N]                 <n> linhas | adicionar/remover favorito
    -> models/TagFavoriteModel.ts           persistencia (contada em Models)

--------------------------------------------------------------------------------
Models + types                             2 arquivos, <total> linhas
  models/TagFavoriteModel.ts [N]             leitura/escrita de favoritos
  types/tag.ts [M]                           contratos e isFavorite

--------------------------------------------------------------------------------
Tests / backend/tests/                     1 arquivo, <total> linhas
  tagFavorite.test.ts [N]                   idempotencia e isolamento

================================================================================
SUPABASE / DDL                             <previsto/aplicado/conferido em DATA>
================================================================================

Public / tabelas e colunas
  tag_favorites [criar]                     vinculo usuario/tag
    user_id uuid NOT NULL                  usuario que favoritou
    tag_id uuid NOT NULL                   tag favorita
    created_at timestamptz DEFAULT now()    NOT NULL; instante do vinculo

--------------------------------------------------------------------------------
Indices + acesso + Realtime
  UNIQUE (user_id, tag_id) [criar]          impede favoritos duplicados
  RLS/policies/grants [definir]            <operacoes, predicados e roles>
  publication/Realtime [definir]           <entra, preserva ou nao se aplica>
  Aplicacao via Management API            sem arquivo .sql; detalhes na fase DDL

================================================================================
FRONTEND / frontend/
================================================================================

Components                                 3 arquivos, <total> linhas
  TagButton.tsx [M]                          acao de favoritar
  TagList.tsx [M]                            lista e estado de favorito
  TagSearch.tsx [B]                          busca existente reutilizada

--------------------------------------------------------------------------------
Hooks                                      1 arquivo, <total> linhas
  --- Favoritos ---
  useTagFavorite.ts [N]                     <n> linhas | estado otimista e rollback
    -> services/apiClient.ts               transporte (contado em Services)

--------------------------------------------------------------------------------
Services + lib + types                     <qtd> arquivos, <total> linhas
  --- Services: 1 arquivo, <subtotal> linhas ---
  services/apiClient.ts [B]                 <n> linhas | transporte autenticado
  --- Lib: <qtd> arquivos, <subtotal> linhas ---
  lib/<arquivo-real>.ts [B/M/N]             <n> linhas | <responsabilidade>
  --- Types: <qtd> arquivos, <subtotal> linhas ---
  types/<arquivo-real>.ts [B/M/N]           <n> linhas | <contrato>

--------------------------------------------------------------------------------
Tests / frontend/tests/                    1 arquivo, <total> linhas
  useTagFavorite.test.ts [N]                atualizacao e rollback no erro
================================================================================
```

---

## Checklist resumida

> **Se houver DDL**, a linha da fase correspondente deve enumerar de forma curta a tabela e as mudancas estruturais (colunas, constraints, indices, RLS/policies/grants e Realtime/publication). A fase final deve exigir a verificacao dessas mesmas pos-condicoes no banco. Nunca resumir apenas como "ajustar banco" ou "DDL".

```
Fase 0: <acao em 1 linha>
Fase 1: <acao em 1 linha>
Fase 2: <acao em 1 linha>; DDL em <schema.tabela>: <colunas/tipos + constraints + indices + RLS/Realtime>
Fase 3: <acao em 1 linha>
Fase 4: <acao em 1 linha> — opcional
Fase 6: validar no banco as pos-condicoes do DDL acima — separado
```

---

## Passo a passo

> **Commits sugeridos:** seguir a [skill de commits](../../../.claude/skills/commit/SKILL.md), fonte da organizacao e apresentacao do lote. Usar `feat(<nome-da-feature>): <area do mapa> - <mudanca concreta>`, com o mesmo prefixo em todas as sugestoes da feature, inclusive testes, hooks e documentacao. A sugestao por fase nao obriga um commit por fase: o agrupamento final segue os caminhos do Mapa de arquivos, com arquivos inteiros, conforme a skill.

> **Reaproveitamento e por fase** — cada fase abre com **Reaproveita**: o que ESTA fase reusa (`arquivo:linha` + como), pra ter o contexto no ponto de implementacao. Nao use uma tabela global desconectada. A busca do que ja existe acontece antes de quebrar em fases, mas o RESULTADO vive dentro de cada fase, colado nas acoes que o consomem. O que e genuinamente novo aparece marcado com ✨ no diagrama e nas acoes da fase.
>
> **Graphify e obrigatorio nessa busca** — ao levantar os elementos que serao reaproveitados, combine Explore/`rg` com o grafo versionado em `graphify-out/`. Use as comunidades e arestas `semantically_similar_to` para encontrar mecanismos equivalentes mesmo quando os nomes diferem; para contratos compartilhados, filtre as arestas do `graph.json` pelos simbolos exatos para confirmar callers e leitores. O grafo complementa a leitura do codigo: todo achado citado no **Reaproveita** ainda deve ser validado no arquivo-fonte e registrado como `arquivo:linha` + forma de uso.
>
> **Contrato travado** — logo depois do Objetivo, liste as decisoes JA tomadas que continuam valendo depois que a fase fechar. Acao e imperativa e some quando executada ("expor `purpose=import` no controller"); contrato e declarativo e permanece ("a variante de import retorna SOMENTE `id`, `account_id`, `name`, `account_status`"). Teste pra saber se a linha pertence aqui: ela e verificavel depois do commit E alguem razoavel poderia viola-la sem perceber que estava violando. Quase sempre carrega um "nao faca X" com o motivo colado — sem o motivo a regra vira arbitraria e e a primeira a ser reinterpretada por quem implementa. Se a linha nao sobrevive a fase, e acao, nao contrato.
>
> **Cenarios obrigatorios** — tabela `cenario -> resultado obrigatorio`, escrita ANTES do codigo e escopada so nesta fase: e a fonte do arquivo de teste, nao um resumo dele (cada linha vira um `it(...)`). Priorize os caminhos feios — erro classificado errado, evento perdido, resposta que sumiu, falha parcial no meio do lote —, que sao os que um executor pula quando o criterio e so "a feature funciona". Nao confundir com **Validacao parcial**: cenario e comportamento provado por teste automatizado; validacao parcial e como confirmar rodando (smoke, log, rota). Fase sem teste automatizado usa so Validacao parcial; fase com teste usa os dois, sem repetir um no outro.
>
> **DDL aparece tres vezes, com o mesmo contrato:** se uma fase mexe na estrutura do banco, (1) o **Diagrama** mostra os objetos e relacoes alterados, (2) a **Checklist resumida** enumera a mudanca em uma linha e (3) a **fase correspondente** inclui um bloco `DDL desta fase` com SQL/operacoes equivalentes, tipos, nullability/defaults, constraints, indices, RLS/policies/grants, publication/Realtime, forma de aplicacao, rollback quando pertinente e pos-condicoes verificaveis. Neste projeto, aplicar via Supabase Management API e nao criar migration `.sql`.

### Fase 1 — `<titulo curto>`

**Objetivo:** `<resultado da fase em 1 linha>`.

**Contrato travado:** `<decisoes que continuam valendo depois desta fase: "X retorna SOMENTE Y", "nao faca Z porque W". Omita se a fase nao trava nenhuma decisao.>`

**Reaproveita:** `<o que ESTA fase reusa: arquivo:linha + como reusar. "Nada — fase 100% nova" se for o caso.>`

**DDL desta fase (obrigatorio quando houver alteracao estrutural):** `<schema.tabela; CREATE/ALTER/DROP; cada coluna com tipo/nullability/default; constraints; indices; RLS/policies/grants; publication/Realtime; Management API; rollback; pos-condicoes. Omitir somente quando nao houver DDL.>`

1. Em `<arquivo>`
2. `<acao concreta>`.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| `<estado ou entrada>` | `<o que TEM que acontecer>` |
| `<caminho feio: erro, evento perdido, falha parcial>` | `<o que TEM que acontecer>` |

**Validacao parcial:** `<como confirmar rodando: smoke, log, rota>`.

**Commit sugerido:** `feat(<nome-da-feature>): <area do mapa> - <mudanca concreta>`

---

### Fase N — `<titulo curto>`

**Objetivo:** `<resultado da fase em 1 linha>`.

**Contrato travado:** `<decisoes desta fase que continuam valendo depois dela.>`

**Reaproveita:** `<o que ESTA fase reusa: arquivo:linha + como reusar.>`

**DDL desta fase (obrigatorio quando houver alteracao estrutural):** `<mesmo contrato exibido no Diagrama e na Checklist resumida; omitir somente quando nao houver DDL.>`

1. `<acao concreta>`.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| `<estado ou entrada>` | `<o que TEM que acontecer>` |

**Validacao parcial:** `<como confirmar rodando: smoke, log, rota>`.

**Commit sugerido:** `feat(<nome-da-feature>): <area do mapa> - <mudanca concreta>`

---

### Fase final — Validacao (smoke test)

- Conferir o Mapa de arquivos contra os caminhos e responsabilidades finais; atualizar estados, consolidacoes e contagens.
- Se houve DDL: consultar o catalogo pela Supabase Management API e provar colunas/tipos/nullability/defaults, constraints, indices, RLS/policies/grants e publication/Realtime exatamente como descritos no Diagrama, na Checklist resumida e na fase correspondente.
- `npm run typecheck -w backend` → 0 erros.
- `npm run lint -w backend` → 0 erros.
- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Testes Jest PERTINENTES (NUNCA a suite inteira — o WSL trava): `npm test -w backend -- <arquivo>` / `npm test -w frontend -- <arquivo>`, ou `-- -o` / `-- --findRelatedTests <arquivo>`.
- Reinicia backend (`npm run dev -w backend`).
- Abre `<rota>` no frontend; `<comportamento esperado>`.
- Faz `<acao chave>`; ve no log:
  - `[<servico>] <linha esperada>`
- `<cenario E2E critico>`.
- `<cenario edge case que costuma quebrar>`.
