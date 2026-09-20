---
name: Cache do arquivo oficial com revalidacao
overview: Guarda em memoria o arquivo baixado da origem e revalida por ETag, para que folhear paginas nao rebaixe o arquivo inteiro a cada request — e expoe na resposta quando o conteudo foi coletado.
todos: []
isProject: false
---

# `Cache do arquivo oficial com revalidacao`

---

## Problema

`GET /data-sources/files/:id/preview` baixa o arquivo **inteiro** da origem oficial a cada
request, antes de paginar (`DataCatalogController.ts:76`). Como a paginacao acontece depois
do download, **cada pagina e um download completo**:

```
pagina 1 → baixa DespesaSenado.csv (225 KB) → parseia tudo → devolve 20 linhas
pagina 2 → baixa DespesaSenado.csv (225 KB) → parseia tudo → devolve 20 linhas
```

Medido na origem em 2026-09-20:

| Arquivo | Tamanho | Entrega |
|---|---|---|
| `DespesaSenado.csv` | 225 KB | 20 linhas |
| `DespesaSenadoDadosAbertos.json` | 497 KB | 20 linhas |
| `ReceitasSenado.csv` | 226 KB | 20 linhas |

Folhear 5 paginas custa ~1,1 MB baixado do Senado para mostrar 100 linhas. Cada request
ainda paga o handshake TLS 1.2 forcado naquele host (`officialHttpGet.ts:32`).

Tres agravantes:

1. **A abertura da API multiplica isso.** Com `/data-sources` publico, a repeticao deixa de
   ser limitada pelo cadastro.
2. **O projeto ja resolveu isso uma vez, so nao no caminho geral.** `fetchSpFazendaExpenses`
   tem cache em memoria com TTL de 15 min (`fetchSpFazendaExpenses.ts:9,78-79`); quem passa
   por `fetchSourceFile` ficou de fora.
3. **A resposta nao diz quando o conteudo foi lido.** `collectedAt` existe no `Dataset`
   (`types/dataCatalog.ts:109`), mas se refere a leitura da *pagina* do portal. O
   `FilePreview` nao tem campo equivalente — hoje e sempre "agora", implicito. No momento em
   que existir cache, "agora" deixa de ser verdade e o principio de procedencia obriga a
   dizer a data.

---

## Solucao

Guardar o buffer baixado em memoria, chaveado por URL, e **revalidar por ETag** em vez de
rebaixar.

As origens mandam `ETag` e `Last-Modified` — conferido em 2026-09-20 nos tres arquivos do
Arquimedes. Entao, quando o TTL vence, um `If-None-Match` responde **304 sem corpo**: o
custo de saber que nada mudou deixa de ser 225 KB e vira um cabecalho.

Isso importa porque **esses arquivos mudam diariamente**, e nao na frequencia declarada:

```
DespesaSenado.csv    last-modified: Sat, 19 Sep 2026
ReceitasSenado.csv   last-modified: Sun, 20 Sep 2026   ← no mesmo dia da medicao
```

O catalogo anuncia `updateFrequency` anual para esses conjuntos, entao **o TTL nao pode ser
derivado do que o orgao declara** — a revalidacao e que da a garantia.

Custo de memoria: o catalogo declara 40 arquivos somando **1,58 MB**, o maior com 497 KB
(`DataCatalogModel.ts`, campo `sizeInBytes`). Cachear o corpus inteiro cabe folgado em
memoria; ainda assim o cache leva teto explicito, porque o catalogo cresce a cada fonte nova.

**Nao entra neste plano:** persistir em Supabase Storage. Resolveria sobreviver a restart e
daria historico versionado, mas custa bucket, tabela, retencao e invalidacao — e o ganho
marginal sobre o cache em memoria e pequeno enquanto o corpus couber em poucos MB. Gatilho
para revisitar: corpus passar de ~50 MB, ou o produto precisar responder "como era em agosto".

---

## Diagrama: estado atual vs. desejado

### Atual

```text
GET /data-sources/files/:id/preview?page=2
     │
     ▼
DataCatalogController.preview                   (existente)
     │   linha 76: baixa ANTES de paginar
     │
     ├─ file.sourceQuery ──► fetchSpFazendaExpenses   (existente — JA tem cache 15 min)
     │                            └─ snapshots: Map<year, CachedSnapshot>
     │
     └─ senao ──────────────► fetchSourceFile         (existente — SEM cache)
                                   │
                                   ▼
                              officialHttpGet         (existente)
                                   │ TLS 1.2 + redirect
                                   ▼
                              origem oficial     ◄── 225 KB por PAGINA
     │
     ▼
parseSpreadsheet / parseFinancialReport         (existente — reparseia tudo)
     │
     ▼
FilePreview                                      (existente)
     └─ sem campo de data de coleta             ◄── "agora" implicito
```

### Desejado

```text
GET /data-sources/files/:id/preview?page=2
     │
     ▼
DataCatalogController.preview                   (existente — le collectedAt do retorno)
     │
     └─────────────────────► fetchSourceFile         (existente — ganha cache)
                                   │
                                   ├─ cache HIT (dentro do TTL)
                                   │     └─► devolve buffer + collectedAt    ◄── 0 bytes de rede
                                   │
                                   ├─ cache VENCIDO + tem etag
                                   │     └─► officialHttpGet(If-None-Match)
                                   │           ├─ 304 ──► renova expiresAt, mantem buffer
                                   │           │            ◄── so cabecalho, sem corpo
                                   │           └─ 200 ──► substitui buffer, etag e collectedAt
                                   │
                                   ├─ cache VENCIDO + origem falhou
                                   │     └─► serve o buffer velho          ◄── stale-on-error
                                   │            com collectedAt antigo, sem mentir a data
                                   │
                                   └─ cache MISS ──► baixa e guarda

backend/src/utils/sourceFileCache.ts            ✨ NOVO — o cache isolado (~70 linhas)
         ├─ entries: Map<url, CachedFile>
         │     └─ { body, etag?, lastModified?, collectedAt, expiresAt, bytes }
         ├─ get(url) / set(url, entry)
         ├─ TTL 15 min                          ◄── mesmo do cache que ja existe
         └─ teto: MAX_ENTRIES + MAX_TOTAL_BYTES ◄── evicta o mais antigo

     ┌─────────────────────────────────────────────────────────────────┐
     │ Contrato de fetchSourceFile                                     │
     │   antes: (url) => Promise<Buffer>                               │
     │   agora: (url) => Promise<SourceFileResult>                     │
     │            { body: Buffer, collectedAt: string }                │
     │                                                                 │
     │ FilePreview ganha `collectedAt: string` (ISO 8601)              │
     │   ─ quando o CONTEUDO foi lido da origem                        │
     │   ─ distinto de Dataset.collectedAt (leitura da pagina)         │
     └─────────────────────────────────────────────────────────────────┘
     │
     ▼
frontend/.../FonteDeDadosView.tsx               (existente — mostra a data)
     └─ ao lado de "Atualizado em" (linha 908)
```

> Convencoes de notacao e dicas de uso: [diagrama-arquitetura.template.plan.md](../../templates/diagrama-arquitetura.template.plan.md).

---

## Mapa de arquivos

```text
Mapa de arquivos
================================================================================
BACKEND / backend/src/
================================================================================

Utils                                      3 arquivos, 227 linhas
  --- Cache e busca na origem ---
  utils/sourceFileCache.ts [N]              ~70 linhas | Map por url, TTL, teto, eviccao
  utils/fetchSourceFile.ts [M]               33 linhas | consulta cache, revalida, devolve
    -> utils/officialHttpGet.ts [B]         124 linhas | transporte; JA aceita headers
  utils/fetchSpFazendaExpenses.ts [B]       144 linhas | fora do escopo: ja tem cache proprio

--------------------------------------------------------------------------------
Controllers + types                        2 arquivos, 330 linhas
  controllers/DataCatalogController.ts [M]  134 linhas | le collectedAt e poe no preview
  types/dataCatalog.ts [M]                  196 linhas | FilePreview ganha collectedAt

--------------------------------------------------------------------------------
Tests / backend/src/tests/                 2 arquivos, ~148 linhas
  tests/fetchSourceFile.test.ts [M]          88 linhas | ganha os casos de cache e 304
  tests/sourceFileCache.test.ts [N]         ~60 linhas | TTL, eviccao por teto

================================================================================
FRONTEND / frontend/
================================================================================

Tela + types                               2 arquivos, 1450 linhas
  app/(dashboard)/fonte-de-dados/FonteDeDadosView.tsx [M]
                                           1257 linhas | exibe a data de coleta do conteudo
  types/dataCatalog.ts [M]                  193 linhas | espelha o contrato do backend
================================================================================
```

---

## Checklist resumida

```
Fase 1: cache em memoria por url, com TTL e teto — sourceFileCache.ts + teste
Fase 2: fetchSourceFile consulta o cache e revalida por ETag (304 nao rebaixa)
Fase 3: collectedAt no FilePreview e na tela
Fase 4: smoke test
```

---

## Passo a passo

### Fase 1 — `cache isolado, com teto`

**Objetivo:** um modulo que guarda buffer por url, expira por TTL e nao cresce sem limite.

**Contrato travado:** o cache guarda **bytes crus da origem**, nunca resultado de parse — o
parse depende de `page`, `limit` e `filters`, entao cachear o parseado multiplicaria as
chaves e serviria dado filtrado para a query errada. O cache tambem nao decide politica de
rede: quem fala com a origem e o `fetchSourceFile`.

**Reaproveita:** `backend/src/utils/fetchSpFazendaExpenses.ts:9,22-27,78-79` — o formato ja
usado no projeto (`Map` + campo `expiresAt`, comparado com `Date.now()`, TTL de 15 min).
Seguir o mesmo vocabulario, em vez de introduzir um segundo. O mesmo arquivo tambem ja traz
a guarda de tamanho (`MAX_RESPONSE_BYTES`, linha 8) que inspira o teto daqui.

1. Em `backend/src/utils/sourceFileCache.ts` (novo) → `CachedFile` com `body`, `etag?`,
   `lastModified?`, `collectedAt`, `expiresAt` e `bytes`.
2. `get(url)` devolve a entrada mesmo **vencida** — quem decide o que fazer com ela e o
   chamador, que pode revalidar ou servir stale.
3. `set(url, entry)` aplica o teto: enquanto exceder `MAX_ENTRIES` ou `MAX_TOTAL_BYTES`,
   remove a entrada de coleta mais antiga.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| `set` e `get` dentro do TTL | devolve a entrada com `isFresh` verdadeiro |
| `get` depois do TTL | devolve a entrada, marcada como vencida — nao descarta |
| `get` de url nunca vista | `undefined` |
| teto de entradas estourado | remove a mais antiga, mantem a recem-inserida |
| teto de bytes estourado por um arquivo grande | remove ate caber; nunca guarda acima do teto |

**Validacao parcial:** `npm test -w backend -- src/tests/sourceFileCache.test.ts`.

**Commit sugerido:** `feat(cache-arquivo-oficial): utils - cache de arquivo por url com teto`

---

### Fase 2 — `revalidacao por ETag`

**Objetivo:** dentro do TTL nao ha rede; vencido, um `If-None-Match` decide sem baixar corpo.

**Contrato travado:** `fetchSourceFile` passa a devolver `{ body, collectedAt }`, e
`collectedAt` e **o instante em que aqueles bytes vieram da origem** — nunca o instante da
request. Num 304, a data **nao** avanca: o conteudo continua sendo o que foi baixado antes,
e mentir isso quebraria a procedencia. Se a origem falhar e houver cache vencido, servir o
stale e legitimo *porque* a data acompanha; sem a data, nao seria.

**Reaproveita:** `backend/src/utils/officialHttpGet.ts:43-46,82-86` — `OfficialHttpOptions`
ja aceita `headers`, espalhados no request, entao mandar `If-None-Match` nao exige tocar no
transporte. `officialHttpGet.ts:37-41` ja devolve `headers` da resposta, de onde sai o
`etag`. `backend/src/utils/fetchSourceFile.ts:17-19` ja tem a traducao de status fora de 2xx
para `AppError(502)`; o 304 precisa ser tratado **antes** dela, senao vira erro.

1. Em `backend/src/utils/fetchSourceFile.ts` → consultar o cache; entrada fresca retorna sem
   rede.
2. Entrada vencida com `etag` → repetir o GET com `If-None-Match`; em **304**, renovar
   `expiresAt` mantendo `body` e `collectedAt`.
3. Em **200**, gravar body, etag e `collectedAt` novo.
4. Sem entrada, ou entrada sem etag → baixar como hoje e gravar.
5. Falha de rede com entrada vencida em maos → servir a entrada e registrar no log.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| dois GETs seguidos na mesma url | `node:https` chamado **uma** vez |
| TTL vencido e origem responde 304 | sem corpo baixado; serve o buffer antigo e **mantem** `collectedAt` |
| TTL vencido e origem responde 200 com bytes novos | substitui buffer e **avanca** `collectedAt` |
| origem sem `ETag` no 200 | funciona por TTL puro; nao envia `If-None-Match` na proxima |
| TTL vencido e origem cai (502/timeout) | serve o stale com a data antiga, sem lancar |
| cache vazio e origem cai | lanca `AppError` como hoje — nao ha o que servir |
| urls diferentes | nao compartilham entrada |

**Validacao parcial:** `npm test -w backend -- src/tests/fetchSourceFile.test.ts` — o mock de
`node:https` ja existe (`fetchSourceFile.test.ts:16-31`) e aceita headers, entao o 304 se
simula sem infra nova.

**Commit sugerido:** `feat(cache-arquivo-oficial): utils - revalida por ETag em vez de rebaixar`

---

### Fase 3 — `procedencia na resposta e na tela`

**Objetivo:** quem le o preview sabe de quando e aquele conteudo.

**Contrato travado:** `FilePreview.collectedAt` e a data do **conteudo**; `Dataset.collectedAt`
continua sendo a data em que lemos a **pagina** do portal. Sao coisas diferentes e nao devem
ser fundidas num campo so.

**Reaproveita:** `backend/src/types/dataCatalog.ts:106-109` — o par `officialUrl` +
`collectedAt` ja e o vocabulario de procedencia do projeto; o novo campo segue o mesmo nome e
formato ISO 8601. No front, `FonteDeDadosView.tsx:908` ja renderiza `MetaItem label="Atualizado em"`
com `formatDate`, entao a data nova entra ao lado, sem componente novo.

1. Em `backend/src/types/dataCatalog.ts` → `collectedAt: string` em `FilePreviewPagination`
   (herdado pelos dois layouts).
2. Em `backend/src/controllers/DataCatalogController.ts:76` → consumir `{ body, collectedAt }`
   e repassar nos dois objetos `FilePreview`.
3. Em `frontend/types/dataCatalog.ts` → espelhar o campo.
4. Em `frontend/app/(dashboard)/fonte-de-dados/FonteDeDadosView.tsx` → exibir como
   "Conteudo lido em <data>" junto do bloco de metadados.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| preview tabular e preview de relatorio | ambos trazem `collectedAt` preenchido |
| segunda pagina servida do cache | `collectedAt` **igual** ao da primeira, nao a hora atual |

**Validacao parcial:** abrir a Fonte de dados, paginar duas vezes e ver a mesma data;
no log do backend, um unico download.

**Commit sugerido:** `feat(cache-arquivo-oficial): api - expoe a data de coleta do conteudo`

---

### Fase final — Validacao (smoke test)

- Conferir o Mapa de arquivos contra os caminhos finais; atualizar estados e contagens.
- `npm run typecheck -w backend` → 0 erros.
- `npm run lint -w backend` → 0 erros.
- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Testes Jest PERTINENTES: `npm test -w backend -- src/tests/sourceFileCache.test.ts` e
  `npm test -w backend -- src/tests/fetchSourceFile.test.ts`.
- Reinicia backend (`npm run dev -w backend`).
- **E2E:** abrir a Fonte de dados, escolher "Dotacao e despesas executadas", folhear 5
  paginas; ver no log **um** `[preview]` de download, nao cinco.
- **Edge case:** esperar o TTL vencer e paginar de novo; a origem devolve 304 e a data
  exibida **nao** muda.
- **Edge case:** derrubar a rede e paginar; o preview continua respondendo com a data antiga,
  em vez de 502.
