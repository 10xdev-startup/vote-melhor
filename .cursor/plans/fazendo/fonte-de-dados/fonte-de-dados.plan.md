---
name: fonte-de-dados
overview: Pagina de catalogo que da nome legivel e contexto aos arquivos brutos que o governo publica, comecando pelo grupo Orcamento do Senado.
todos: []
isProject: false
---

# `Fonte de dados — catalogo navegavel dos arquivos oficiais`

---

## Problema

Os dados ja sao publicos, mas descobrir **qual arquivo baixar** e a primeira barreira — e
ela vem antes de qualquer normalizacao ou IA.

No grupo `Orcamento do Senado` (o exemplo que motivou o pedido):

- Os 40 arquivos aparecem no portal rotulados apenas como `CSV` ou `JSON`. O rotulo nao diz
  o que o arquivo contem.
- O nome real so existe dentro da URL, e o padrao muda a cada exercicio:
  `Balanco Patrimonial 2020.csv` → `BGUBPAnualOrgao2000OrgSup.csv` → `BGU-BP-Anual-Orgao2000-OrgSup.csv`
  → `bgu-bp-trimestre4-encerrado-orgao2000-orgsup.csv` → `bp.csv`. Sao o mesmo demonstrativo
  em cinco grafias diferentes.
- O contexto (o que e, periodicidade, orgao responsavel, sistema de origem) fica preso num
  accordion que precisa ser aberto conjunto a conjunto.
- Nao existe busca: achar "fluxo de caixa de 2023" exige abrir 6 accordions e ler 36 links
  chamados `CSV`.

Resultado pratico: mesmo quem sabe o que procura baixa arquivo as cegas.

---

## Solucao

Uma pagina `Fonte de dados` (1o item da sidebar) onde **cada linha e um arquivo**, com nome
curado em portugues, uma frase explicando o que ele contem, formato e tamanho — mais busca
que filtra as 40 linhas ao vivo.

Os seis demonstrativos se repetem identicos a cada exercicio: o que muda e o ano e a URL.
Entao o exercicio e uma **edicao** do conjunto, navegavel por `< 2025 >`, em vez de seis
conjuntos repetidos. A pagina fica com **3 cards** no lugar de 8, sem perder nenhum arquivo.

A pagina usa **uma cor so** (azul). Cor por conjunto foi testada e descartada: ela saia da
posicao na lista, entao nao significava nada — e, pior, sugeria significado (despesa saiu
ambar, receita saiu verde) que o dado nao carrega, alem de deslizar toda vez que o crawler
trouxesse um conjunto novo. Azul nao sugere entrada nem saida. Cor por conjunto so volta se
virar semantica de verdade, como campo do modelo.

O jargao do orgao recebe o mesmo tratamento que o nome de arquivo: `Origem: SIAFI` nao diz
nada a quem chega de fora, entao a sigla ganha um `i` que explica o sistema no hover e leva
a pagina oficial no clique. `SourceSystem` e tipo do modelo (nao texto na UI) porque a
definicao carrega procedencia — e as duas origens vem de fontes diferentes: o Arquimedes esta
na lista de sistemas internos do Senado, o SIAFI e do Tesouro Nacional e por isso nao esta.

Decisoes tomadas com o dev antes de codar:

| Decisao | Escolha | Motivo |
| --- | --- | --- |
| Escopo | So o grupo `Orcamento do Senado` (8 conjuntos, 40 arquivos) | Escopo fechado permite curar nome por nome, que e o valor da pagina |
| Origem do conteudo | Catalogo curado versionado no frontend | Nao ha crawler ainda; o shape ja e o que o backend vai devolver |
| Clique na linha | Download do arquivo oficial | Visualizador de planilha e fase 2, decidida pelo dev |
| Acesso | Rota logada em `(dashboard)` | Onde a sidebar existe |

O catalogo carrega **procedencia** (`officialUrl` do conjunto + `collectedAt`), como exige o
principio "dado oficial e a unica fonte de verdade": nenhum arquivo e re-hospedado, todo
download aponta para o dominio do Senado.

**Fase 2 (fora deste plano):** visualizador de planilha. O `backend/src/utils/parseSpreadsheet.ts`
da 10x-mkt e reaproveitavel — ja faz fallback de encoding `utf-8` → `windows-1252`, que e
exatamente o problema encontrado aqui (`bp.csv` e latin-1, `DespesaSenado.csv` e utf-8).
Atencao: os CSVs de demonstracoes contabeis nao sao tabelas limpas — comecam com linhas
`;;;;;` e cabecalho institucional do Tesouro, entao o viewer precisa de deteccao de header.

---

## Checklist resumida

```
Fase 1: contrato de tipos do catalogo (types/dataCatalog.ts)
Fase 2: catalogo curado do Orcamento do Senado (lib/dataCatalog.ts)
Fase 3: pagina /fonte-de-dados com lista por arquivo + busca
Fase 4: item "Fonte de dados" em 1o lugar na sidebar
Fase 5: smoke test
```

---

## Passo a passo

### Fase 1 — Contrato do catalogo

**Objetivo:** definir o shape que o crawler do backend vai devolver depois, para a troca de
origem ser uma funcao so.

1. Em `frontend/types/dataCatalog.ts` → criar `DataFile` (arquivo individual: nome curado,
   descricao, formato, url oficial, bytes), `DatasetEdition` (exercicio: rotulo, ano,
   ultima atualizacao, `files`) e `Dataset` (conjunto: titulo, descricao, orgao, grupo,
   sistema de origem, periodicidade, url oficial, `collectedAt`, `editions`).

**Validacao parcial:** `npm run typecheck -w frontend` limpo.

**Commit sugerido:** `feat(fonte-de-dados): define o contrato do catalogo de arquivos`

---

### Fase 2 — Catalogo curado do Orcamento do Senado

**Objetivo:** os 40 arquivos com nome legivel e frase explicativa.

1. Em `frontend/lib/dataCatalog.ts` → declarar os 6 demonstrativos contabeis (BP, BF, BO,
   DVP, DFC, DMPL) com nome e descricao em portugues simples, e o mapa `ano → nome de arquivo`
   que resolve as cinco grafias diferentes do portal. Cada exercicio vira uma edicao, em
   ordem crescente (a UI abre na mais recente).
2. Declarar os 2 conjuntos de serie continua (`Dotacao autorizada e despesas executadas`
   desde 2013, `Receitas proprias` desde 2012), cada um com uma edicao so, CSV + JSON.
3. Exportar `getDataCatalog()` — o unico ponto que muda quando o backend assumir.

**Validacao parcial:** teste Jest conferindo 3 conjuntos, 6 edicoes no de demonstracoes,
40 arquivos, zero id duplicado e toda url apontando para dominio do Senado.

**Commit sugerido:** `feat(fonte-de-dados): cataloga os 40 arquivos do orcamento do Senado`

---

### Fase 3 — Pagina

**Objetivo:** a tela.

1. Em `frontend/app/(dashboard)/fonte-de-dados/page.tsx` → cabecalho + contagem.
2. Em `frontend/app/(dashboard)/fonte-de-dados/FonteDeDadosView.tsx` → busca (client) e a
   lista agrupada por conjunto, uma linha por arquivo, com download e link para a pagina
   oficial. O card guarda o **id** da edicao selecionada, nao o indice: a busca troca a
   lista de edicoes debaixo dele, e um indice guardado apontaria pro ano errado.

**Validacao parcial:** `/fonte-de-dados` abre em 2025; a seta `<` troca o arquivo apontado
para `/2024/`; busca por "fluxo de caixa" reduz a 6 arquivos em 6 exercicios.

**Commit sugerido:** `feat(fonte-de-dados): adiciona a pagina de catalogo`

---

### Fase 4 — Sidebar

**Objetivo:** `Fonte de dados` como primeiro item.

1. Em `frontend/components/AppSidebar.tsx` → inserir o item no topo de `NAV_ITEMS`.

**Validacao parcial:** item aparece em 1o e fica ativo em `/fonte-de-dados`.

**Commit sugerido:** `feat(sidebar): coloca Fonte de dados como primeiro item`

---

### Fase 5 — Smoke test

1. `npm run typecheck -w frontend` + `npm run lint -w frontend`
2. `npm test -w frontend -- tests/dataCatalog.test.ts tests/fonteDeDadosView.test.tsx`
3. E2E: logar → sidebar mostra `Fonte de dados` em 1o → clicar → navegar de 2025 a 2020
   pelas setas → buscar "patrimonial" → baixar um arquivo e confirmar que abre no dominio
   do Senado, no exercicio certo.
4. Edge case: busca sem resultado mostra estado vazio, nao lista quebrada; buscar um ano
   colapsa o seletor de exercicio sem quebrar o card.

---

## Diagrama

### Hoje

```
Portal do Senado (accordion)
  └── "CSV" · "CSV" · "CSV" ...   ◄── rotulo nao diz o que e
```

### Desejado

```
frontend/
├── types/dataCatalog.ts          ✨ NOVO
│   ┌──────────────────────────────────────────────┐
│   │ Dataset  { ..., editions: DatasetEdition[] } │  contrato que o backend
│   │ Edition  { label, year, files: DataFile[] }  │  vai devolver na fase 2
│   │ DataFile { name, description, url }          │
│   └──────────────────────────────────────────────┘
├── lib/dataCatalog.ts            ✨ NOVO  getDataCatalog() ◄── unico ponto a trocar
├── app/(dashboard)/fonte-de-dados/
│   ├── page.tsx                  ✨ NOVO
│   └── FonteDeDadosView.tsx      ✨ NOVO  busca + lista
└── components/AppSidebar.tsx     (existente) ◄── item novo no topo
```
