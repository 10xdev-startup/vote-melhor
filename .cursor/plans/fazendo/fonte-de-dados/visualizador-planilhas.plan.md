---
name: visualizador-planilhas
overview: Preview do conteudo do arquivo dentro da 10xGov, com o catalogo migrando para o backend e virando API.
todos: []
isProject: false
---

# `Visualizador de planilhas — fase 2 da Fonte de dados`

---

## Problema

A Fonte de dados resolveu **achar** o arquivo. Continua sem resolver **saber o que tem
dentro**: pra ver uma coluna o usuario baixa 219 KB de CSV e abre no Excel — e nos CSVs do
governo isso quebra (`ReceitasSenado.csv` e latin-1, e o Excel em pt-BR abre com acento
corrompido e tudo numa coluna so).

Tres coisas foram verificadas nos arquivos reais e definem o trabalho:

1. **Sem CORS.** Nem `www12.senado.leg.br` nem `www.senado.gov.br` mandam
   `Access-Control-Allow-Origin`. O browser nao consegue ler o arquivo — **o proxy no
   backend e obrigatorio**, nao existe versao so-frontend.
2. **Encoding misto dentro do mesmo sistema.** `DespesaSenado.csv` e UTF-8 e
   `ReceitasSenado.csv` e latin-1 — os dois saem do Arquimedes. Adivinhar e obrigatorio.
3. **Sao dois formatos, nao um.** Os 4 arquivos do Arquimedes sao tabela de verdade
   (header na linha 2, `;`, aspas). Os 36 contabeis sao relatorio do Tesouro: 13 linhas de
   preambulo institucional e um balanco de **duas colunas lado a lado** (ATIVO nas colunas
   1-11, PASSIVO da 12 em diante), hierarquia por indentacao e `-` como zero.

---

## Solucao

Preview inline dos **4 arquivos do Arquimedes**, servido por um endpoint do backend que
baixa, decodifica e parseia.

Entregue em duas etapas: primeiro os 4 arquivos tabulares do Arquimedes, depois os 36
demonstrativos contabeis com um renderer proprio (Fase 7) — a etapa que o levantamento ja
previa, porque grade generica neles nao seria mais legivel que o CSV cru.

Decisoes tomadas com o dev:

| Decisao | Escolha | Motivo |
| --- | --- | --- |
| Escopo (etapa 1) | Os 4 do Arquimedes | Sao os unicos tabulares; entregam valor com um viewer simples |
| Escopo (etapa 2) | Os 36 contabeis, com renderer proprio | Grade generica neles nao seria mais legivel que o CSV cru — precisavam entender o formato BGU |
| Catalogo | Migra para o backend | Elimina SSRF por construcao (o backend so busca URL que ele mesmo conhece) e ja e pra onde o crawler vai |
| Parser | `xlsx@0.18.5` do npm | Alinhado com a 10x-mkt; cobre `.xlsx` que TSE/Transparencia vao trazer |
| Download | `node:https`, nao `fetch` | O `fetch` global estoura `UND_ERR_CONNECT_TIMEOUT` com `www.senado.gov.br`: o handshake TLS 1.3 nao conclui. Detalhe completo em `investigacao-tls-senado.md` |

**Sobre a dependencia:** `xlsx@0.18.5` e a ultima publicada no npm e tem duas advisories
*high* (Prototype Pollution, ReDoS) — o SheetJS migrou a distribuicao pro CDN proprio. A
escolha foi consciente, e a mitigacao no nosso caso e estrutural: o parser **so recebe bytes
de URL que esta no catalogo do proprio backend**, nunca upload de usuario nem URL de fora.
Se um dia entrar upload, essa premissa cai e a versao precisa ser revista.

**Por que `layout` e campo do modelo:** o que decide se a linha tem preview nao e capacidade
tecnica (o parser le os 36 contabeis sem erro) — e o formato. `layout: 'tabular' | 'report'`
diz isso explicitamente, e foi o gancho que permitiu o renderer de BGU entrar depois sem
remodelar nada, em vez de um
`previewable: boolean` que esconde o motivo.

---

## Checklist resumida

```
Fase 1: catalogo migra pro backend (types + model), com `layout` por arquivo
Fase 2: parser de planilha (encoding + CSV/JSON/xlsx)
Fase 3: controller + rotas (GET /data-sources, GET /data-sources/files/:id/preview)
Fase 4: frontend consome a API (service + view com loading)
Fase 5: preview inline na linha
Fase 6: smoke test
Fase 7: renderer proprio para os 36 demonstrativos contabeis
```

---

## Passo a passo

### Fase 1 — Catalogo no backend

**Objetivo:** o backend passa a ser o dono do catalogo.

1. Em `backend/src/types/dataCatalog.ts` → `DataFile` (+ `layout`), `DatasetEdition`,
   `Dataset`, `SourceSystem`, `FilePreview`.
2. Em `backend/src/models/DataCatalogModel.ts` → move o conteudo de
   `frontend/lib/dataCatalog.ts`; expoe `listDatasets()` e `findFileById(id)`.
3. Em `frontend/lib/dataCatalog.ts` → ✂ DELETADO (o dado agora vem da API).

**Validacao parcial:** teste Jest do backend conferindo 3 conjuntos, 40 arquivos, ids unicos
e `layout` correto (4 tabulares, 36 report).

**Commit sugerido:** `refactor(fonte-de-dados): move o catalogo para o backend`

---

### Fase 2 — Parser

**Objetivo:** transformar bytes em `{ columns, rows }`.

1. Em `backend/src/utils/parseSpreadsheet.ts` → decodifica (UTF-8 estrito com fallback
   windows-1252), e le CSV/xlsx via `xlsx` ou JSON via `JSON.parse`.
2. JSON do Arquimedes vem como `{ "receitas": [ {...} ] }` — objeto de uma chave so
   envolvendo o array. Desembrulha isso e monta as colunas pela uniao das chaves.
3. Descarta linhas totalmente vazias e corta em `maxRows`.

**Validacao parcial:** teste Jest com bytes latin-1 e UTF-8 fixos no proprio teste (sem
rede), provando que o acento sobrevive nos dois.

**Commit sugerido:** `feat(fonte-de-dados): adiciona o parser de planilha`

---

### Fase 3 — Endpoints

**Objetivo:** expor catalogo e preview.

1. Em `backend/src/controllers/DataCatalogController.ts` → `list` e `preview`.
2. `preview` resolve o id **no catalogo** (404 se nao existir), recusa `layout: 'report'`
   (422 com motivo), busca a URL com timeout e devolve `FilePreview`. O `req.params.id` e
   validado tambem contra array: no Express 5 ele e tipado `string | string[]`.
3. Em `backend/src/utils/fetchSourceFile.ts` → o download em si, isolado do controller
   (`node:https`, timeout de 20s por `AbortController`, status nao-2xx vira
   `SOURCE_UNAVAILABLE`, timeout vira `SOURCE_TIMEOUT`).
4. Em `backend/src/routes/dataCatalogRoutes.ts` + `backend/src/index.ts` → registra
   `/data-sources` atras do `supabaseMiddleware` (a pagina e logada).

**Validacao parcial:** `curl` autenticado em `/data-sources` e no preview de
`senado-receitas-csv`.

**Commit sugerido:** `feat(fonte-de-dados): expoe o catalogo e o preview na API`

---

### Fase 4 — Frontend consome a API

**Objetivo:** a pagina para de ler dado local.

1. Em `frontend/services/dataCatalogService.ts` → `getCatalog()` e `getFilePreview(id)`.
2. Em `FonteDeDadosView.tsx` → busca no mount (o `apiClient` le a sessao do Supabase, entao
   e client), com skeleton e estado de erro.

**Validacao parcial:** a pagina renderiza os 40 arquivos vindos da API.

**Commit sugerido:** `refactor(fonte-de-dados): consome o catalogo pela API`

---

### Fase 5 — Preview inline

**Objetivo:** ver o conteudo sem baixar.

1. A linha deixa de ser um `<a>` unico: vira container com **Ver** (button) e **Baixar**
   (link) — `<button>` dentro de `<a>` e HTML invalido.
2. **Ver** expande a tabela abaixo da linha, com as colunas e as primeiras linhas.
3. Nesta etapa, linha `report` ainda nao mostra **Ver** (liberado na Fase 7).

**Validacao parcial:** clicar em Ver em "Receitas próprias (planilha)" mostra a tabela com
acento correto; nos contabeis o botao nao existe.

**Commit sugerido:** `feat(fonte-de-dados): mostra o conteudo do arquivo na propria pagina`

---

### Fase 5.1 — Total de linhas e soma monetaria

**Objetivo:** o preview dizer o tamanho real do arquivo, nao so o pedaco que coube na tela.

O contrato ganhou `totalRowCount` (linhas de dados no arquivo inteiro, sem o cabecalho) e
`columnTotals` (soma por coluna, calculada sobre **todas** as linhas — nao sobre as 20 do
preview). O rodape passou a dizer `Primeiras 20 de 929 linhas · 10 colunas`.

Regras da soma, em `parseSpreadsheet.ts`:

- Soma **so colunas explicitamente reconhecidas como monetarias** (`TOTALLED_CURRENCY_COLUMNS`).
  Totalizar todo numero produziria soma de ano, mes e codigo de natureza — numeros que somam
  mas nao significam nada.
- Interpreta o formato brasileiro (`1.234,56`, `2483,60`, negativos).
- Acumula em **centavos inteiros**, nao em float: somar 929 valores em ponto flutuante
  acumula erro de arredondamento em dinheiro publico.
- Se a origem mudar para um formato que nao casa, **omite o total** em vez de exibir uma soma
  parcial errada.

**Validacao parcial:** com o arquivo real de 10/08/2026 — 929 registros, total arrecadado
`R$ 155.567.875,30`.

---

### Fase 7 — Renderer dos demonstrativos contabeis

**Objetivo:** os 36 relatorios do Tesouro deixarem de ser so download.

Era a etapa que o levantamento inicial ja previa: os arquivos tem estrutura identica entre si
e sao pequenos (3–17 KB), entao valia um renderer que entenda o formato BGU em vez de uma
grade generica.

`FilePreview` virou **union discriminada** por `layout`, em vez de um shape unico com campos
opcionais — o frontend passa a escolher o componente pelo discriminante, e o TypeScript cobra
o tratamento dos dois casos:

```ts
type FilePreview = TabularFilePreview | ReportFilePreview
```

O `ReportFilePreview` carrega o que a grade jogava fora:

- `title` e `metadata` — o preambulo institucional (orgao, exercicio, periodo, emissao) sai
  das primeiras 13 linhas e vira cabecalho legivel, em vez de linhas `;;;;` no meio da tabela;
- `rows[].kind` (`section` | `header` | `total` | `data`) — a hierarquia que no CSV existia so
  como indentacao por espaco passa a ser explicita;
- `columnCount` — a grade tem largura variavel, e ATIVO/PASSIVO ficam lado a lado como no
  documento oficial.

**Validacao:** os 36 demonstrativos reais de 2020 a 2025 abertos e conferidos; scroll vertical
e horizontal dentro do viewer, com os metadados fixos.

**Commit sugerido:** `feat(fonte-de-dados): renderiza os demonstrativos contabeis do Tesouro`

---

### Fase 6 — Smoke test

1. `npm run typecheck -w backend` + `lint -w backend` + `typecheck -w frontend` + `lint -w frontend`
2. Jest pertinentes dos dois workspaces (nunca a suite inteira).
3. E2E: abrir `/fonte-de-dados` → Ver em Receitas → tabela com acento certo → Baixar ainda
   abre o arquivo oficial.
4. Edge case: arquivo `report` sem botao Ver; backend fora do ar mostra erro, nao tela branca.

---

## Diagrama

### Hoje

```
frontend/lib/dataCatalog.ts (dado local) ──> FonteDeDadosView ──> download direto
                                                                   (browser nao le: sem CORS)
```

### Desejado

```
backend/                                          frontend/
├── models/DataCatalogModel.ts   ✨ NOVO          ├── services/dataCatalogService.ts  ✨ NOVO
│   listDatasets() / findFileById()               │        │
├── utils/parseSpreadsheet.ts    ✨ NOVO          │        ▼
│   bytes ──> { columns, rows, totais }           ├── app/(dashboard)/fonte-de-dados/
├── utils/fetchSourceFile.ts     ✨ NOVO          │   └── FonteDeDadosView.tsx (existente)
│   node:https, TLS 1.2 no host afetado          └── lib/dataCatalog.ts   ✂ DELETADO
├── controllers/DataCatalogController.ts ✨ NOVO
│   ┌───────────────────────────────────┐
│   │ GET /data-sources                 │ ◄──────────── catalogo
│   │ GET /data-sources/files/:id/preview│ ◄──────────── preview
│   └───────────────────────────────────┘
└── routes/dataCatalogRoutes.ts  ✨ NOVO
        │
        ▼
   Senado (sem CORS) ── o backend busca, decodifica e devolve
   └── o fetch global NAO serve aqui: TLS 1.3 pendura (ver investigacao-tls-senado.md)
```
