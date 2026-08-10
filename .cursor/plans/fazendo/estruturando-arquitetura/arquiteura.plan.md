---
name: ""
overview: ""
todos: []
isProject: false
---

# 10xGov — Proposta de Arquitetura da API

## 1. Visão geral

A 10xGov deve funcionar como uma **camada própria e normalizada de dados governamentais brasileiros**, e não apenas como um proxy das APIs oficiais.

As diferentes fontes governamentais possuem modelos, nomenclaturas, identificadores e estruturas diferentes.

Exemplos de fontes:

- Câmara dos Deputados
- Senado Federal
- TSE
- Portal da Transparência
- Diário Oficial da União
- [Compras.gov](http://Compras.gov)
- IBGE
- IPEA
- Tesouro Nacional
- STF
- STJ
- Tribunais de Contas

A função da 10xGov é consumir essas fontes, preservar os dados originais, normalizá-los em um modelo comum e disponibilizá-los através de uma API consistente.

Arquitetura conceitual:

```text
                  ┌────────────────────────────┐
                  │       Fontes oficiais      │
                  │ Câmara | Senado | TSE | ...│
                  └─────────────┬──────────────┘
                                │
                       Connectors / Adapters
                                │
                                ▼
                  ┌────────────────────────────┐
                  │       Raw Data Layer       │
                  │ resposta original da fonte│
                  └─────────────┬──────────────┘
                                │
                         Normalização
                                │
                                ▼
                  ┌────────────────────────────┐
                  │     10xGov Data Model      │
                  │                            │
                  │ people                     │
                  │ mandates                   │
                  │ parties                    │
                  │ propositions               │
                  │ voting_sessions            │
                  │ individual_votes           │
                  │ committees                 │
                  │ speeches                   │
                  │ expenses                   │
                  └─────────────┬──────────────┘
                                │
                ┌───────────────┼────────────────┐
                ▼               ▼                ▼
             REST API         Search          AI / RAG

```

---

# 2. Princípio central

A 10xGov deve ter seu próprio **Canonical Government Model**.

Em vez da aplicação conhecer as particularidades da Câmara, Senado, TSE etc., cada fonte deve possuir um adapter responsável por converter seus dados para o modelo canônico da 10xGov.

```text
CamaraAdapter ─────┐
                   │
SenadoAdapter ─────┤
                   │
TSEAdapter ────────┼───> 10xGov Canonical Model
                   │
TransparencyAdapter┤
                   │
OtherAdapters ─────┘

```

Isso permite adicionar novas fontes sem alterar todo o restante da aplicação.

---

# 3. Person e Mandate

Evitar criar entidades centrais separadas como:

```text
deputados
senadores
vereadores
governadores
prefeitos

```

O ideal é separar **pessoa** de **mandato/cargo**.

Uma pessoa pode ocupar diferentes cargos ao longo do tempo.

Por exemplo:

```text
Pessoa
  │
  ├── Deputado Estadual
  │
  ├── Deputado Federal
  │
  └── Senador

```

Modelo:

```ts
interface Person {
  id: string
  name: string
  birthDate?: Date
}

interface Mandate {
  id: string
  personId: string

  role:
    | "federal_deputy"
    | "senator"
    | "state_deputy"
    | "governor"
    | "mayor"
    | "councilor"
    | "president"
    | "minister"

  state?: string
  partyId?: string

  legislature?: number

  startedAt: Date
  endedAt?: Date
}

```

Dessa forma, "Deputado Federal" não é uma pessoa. É um mandato exercido por uma pessoa durante determinado período.

Isso prepara a arquitetura para expansão futura.

---

# 4. IDs externos

Nunca utilizar o ID da Câmara, Senado ou qualquer outra fonte como ID principal da 10xGov.

Cada entidade deve possuir um ID interno.

Exemplo:

```json
{
  "id": "01J...",
  "name": "Fulano de Tal"
}

```

E os identificadores das fontes devem ser armazenados separadamente.

Sugestão:

```text
external_ids

id
entity_type
entity_id
source
external_id
external_url
created_at
updated_at

```

Exemplo:

```text
person_123

├── camara: 204536
├── tse: 123456789
└── transparencia: 998877

```

Isso será extremamente importante quando a 10xGov começar a cruzar informações entre fontes diferentes.

---

# 5. Propositions

Evitar tabelas diferentes para cada tipo legislativo:

```text
pecs
pls
plps
mps

```

Criar uma entidade genérica:

```ts
interface Proposition {
  id: string

  type: "PEC" | "PL" | "PLP" | "MP" | string

  number: number
  year: number

  title?: string
  summary?: string
  fullText?: string

  house:
    | "chamber"
    | "senate"
    | "congress"

  status?: string

  source: string
  sourceId: string
}

```

Assim:

```text
Proposition
├── PEC 45/2019
├── PL 2338/2023
├── PLP ...
└── MP ...

```

podem compartilhar a mesma infraestrutura.

---

# 6. Votações

Essa parte deve ser modelada cuidadosamente.

Não utilizar simplesmente:

```text
politician
proposition
vote

```

Uma mesma proposição pode passar por diversas votações.

Além disso, uma votação pode ser sobre:

- texto principal;
- substitutivo;
- emenda;
- destaque;
- requerimento;
- redação final;
- outros procedimentos legislativos.

Portanto:

```text
Proposition
     │
     ├── VotingSession
     │       │
     │       ├── IndividualVote
     │       ├── IndividualVote
     │       └── IndividualVote
     │
     └── VotingSession
             │
             ├── IndividualVote
             └── IndividualVote

```

Modelo:

```ts
interface VotingSession {
  id: string

  propositionId?: string

  title?: string
  description?: string

  date: Date

  result?: string

  yesCount?: number
  noCount?: number
  abstentionCount?: number

  source: string
  sourceId: string
}

interface IndividualVote {
  id: string

  votingSessionId: string
  mandateId: string

  vote:
    | "YES"
    | "NO"
    | "ABSTENTION"
    | "OBSTRUCTION"
    | "OTHER"
}

```

Isso permite responder perguntas como:

```text
Como o deputado X votou nessa proposta?

Quais deputados votaram contra?

Quantas vezes esse projeto foi votado?

O deputado mudou de posição durante a tramitação?

Quem costuma votar junto?

Quais partidos foram mais favoráveis?

```

---

# 7. Raw Data Layer

A 10xGov deve preservar a resposta original recebida das APIs governamentais.

Exemplo:

```text
source_snapshots

id
source
endpoint
external_id
payload JSONB
fetched_at
hash

```

Fluxo:

```text
API oficial
     ↓
Raw Snapshot
     ↓
Normalizer
     ↓
10xGov Database

```

Isso é importante por três motivos:

### Auditabilidade

É possível descobrir exatamente de onde determinada informação veio.

### Reprocessamento

Caso exista um bug no normalizador, os dados podem ser processados novamente sem necessariamente consultar toda a API externa.

### Transparência

No futuro pode existir uma cadeia verificável:

```text
Resposta da IA
      ↓
10xGov Entity
      ↓
Raw Government Data
      ↓
Fonte oficial

```

---

# 8. Sincronização

A API pública da 10xGov não deve consultar Câmara/Senado em tempo real para cada request do usuário.

Os dados devem ser sincronizados para o banco da 10xGov.

Exemplo:

```text
Scheduler
    │
    ├── every 5 min
    │      └── new voting sessions
    │
    ├── every 30 min
    │      └── proposition updates
    │
    ├── every 6h
    │      └── politicians / parties
    │
    └── daily
           └── expenses / reconciliation

```

Pipeline:

```text
Government API
       ↓
Connector
       ↓
Raw Snapshot
       ↓
Normalizer
       ↓
Validation
       ↓
Upsert
       ↓
PostgreSQL
       ↓
Search Index

```

Idealmente os jobs devem ser idempotentes.

Rodar o mesmo job duas vezes não pode duplicar entidades.

---

# 9. Connectors

Cada fonte deve possuir seu próprio connector.

Exemplo:

```text
connectors/

  camara/
    client.ts
    deputies.ts
    propositions.ts
    voting.ts
    expenses.ts
    normalizers/

  senado/
    client.ts
    senators.ts
    propositions.ts
    voting.ts
    normalizers/

  tse/
    client.ts
    candidates.ts
    elections.ts
    normalizers/

```

O restante da aplicação não deve precisar saber como a Câmara ou Senado estruturam seus dados.

O connector é responsável por traduzir:

```text
External Government Model
          ↓
10xGov Canonical Model

```

---

# 10. API pública

A API da 10xGov deve ser simples e consistente.

Base:

```text
/v1

```

### People

```http
GET /v1/people
GET /v1/people/:id

```

### Politicians

```http
GET /v1/politicians
GET /v1/politicians/:id

GET /v1/politicians/:id/mandates
GET /v1/politicians/:id/votes
GET /v1/politicians/:id/propositions
GET /v1/politicians/:id/expenses

```

Filtros:

```http
GET /v1/politicians?state=MG
GET /v1/politicians?party=PL
GET /v1/politicians?role=federal_deputy

```

### Propositions

```http
GET /v1/propositions
GET /v1/propositions/:id

GET /v1/propositions/:id/votes
GET /v1/propositions/:id/timeline

```

Busca:

```http
GET /v1/propositions?query=inteligência+artificial
GET /v1/propositions?type=PEC
GET /v1/propositions?year=2026

```

### Voting Sessions

```http
GET /v1/voting-sessions
GET /v1/voting-sessions/:id
GET /v1/voting-sessions/:id/votes

```

### Parties

```http
GET /v1/parties
GET /v1/parties/:id

```

### Votes

```http
GET /v1/votes
GET /v1/votes?politician=:id
GET /v1/votes?proposition=:id
GET /v1/votes?party=PL

```

---

# 11. IA separada da API factual

A IA não deve ser misturada aos endpoints determinísticos.

Separar:

```text
/v1/*

Dados factuais e determinísticos.

```

de:

```text
/v1/ai/*

Inferência, explicação e geração.

```

Exemplo:

```http
POST /v1/ai/ask

```

Request:

```json
{
  "question": "Como os deputados de Minas Gerais votaram na reforma tributária?"
}

```

Response:

```json
{
  "answer": "...",
  "sources": [
    {
      "type": "voting_session",
      "id": "..."
    },
    {
      "type": "proposition",
      "id": "..."
    }
  ]
}

```

Outros endpoints possíveis:

```http
POST /v1/ai/summarize/proposition/:id

POST /v1/ai/explain/voting-session/:id

POST /v1/ai/compare/politicians

POST /v1/ai/ask

```

---

# 12. Regra fundamental da IA

A IA **nunca deve ser a source of truth**.

Ela deve interpretar dados existentes na 10xGov.

Fluxo ideal:

```text
Pergunta

"Como o deputado X votou
na reforma tributária?"

        ↓

Intent / Search

        ↓

10xGov Database

        ↓

Voting Sessions
Individual Votes
Propositions

        ↓

LLM

        ↓

Resposta + fontes

```

Evitar:

```text
Pergunta
   ↓
LLM
   ↓
"acho que foi isso"

```

Toda afirmação factual importante produzida pela IA deve ser rastreável até dados armazenados pela 10xGov e, idealmente, até a fonte governamental original.

---

# 13. Busca

É interessante separar três tipos de busca.

### Busca tradicional

```text
"PEC 45/2019"

```

PostgreSQL / full-text search.

### Busca estruturada

```text
deputados de MG
que votaram SIM
na votação X

```

SQL.

### Busca semântica

```text
"projetos relacionados a regulamentação de inteligência artificial"

```

Embeddings / vector search.

Não utilizar embeddings para coisas que SQL resolve melhor.

---

# 14. Banco

Para o MVP:

```text
PostgreSQL / Supabase

```

É suficiente para:

- dados relacionais;
- JSONB;
- full-text search;
- pgvector;
- filtros;
- agregações;
- analytics iniciais.

Não existe necessidade de adicionar MongoDB, Elasticsearch ou Neo4j no início.

Se algum desses problemas realmente aparecer em escala, eles podem ser adicionados depois.

---

# 15. Stack sugerida

Mantendo compatibilidade com o ecossistema atual da 10xDev:

```text
Node.js
TypeScript
Express
PostgreSQL
Supabase
Next.js

```

Workers podem inicialmente utilizar o mesmo runtime Node.

---

# 16. Estrutura do monorepo

Evitar microservices no MVP.

Começar como um **modular monolith**.

Exemplo:

```text
10xgov/

  apps/

    api/
      src/
        modules/

          people/
          mandates/
          parties/

          propositions/
          voting/
          committees/

          expenses/

          search/
          ai/

    web/

    worker/

  packages/

    database/

    gov-core/

    connectors/

      camara/

      senado/

      tse/

      transparency/

    ai/

    search/

    sdk/

  docs/

```

---

# 17. gov-core

Esse provavelmente será um dos pacotes mais importantes.

```text
packages/gov-core

```

Ele contém o domínio da 10xGov.

Por exemplo:

```text
Person
Mandate
Party
Proposition
VotingSession
IndividualVote
Committee
Expense
Speech
Event

```

Esse pacote não deve depender da Câmara ou Senado.

Ele representa o modelo canônico.

---

# 18. Modelo conceitual inicial

Uma primeira versão pode ser:

```text
                         Person
                           │
                           │
                        Mandate
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
         Proposition   IndividualVote  Expense
              │            │
              │            │
              ▼            ▼
            Event     VotingSession
                           │
                           ▼
                      Proposition

```

Complementado por:

```text
Party
Committee
Speech
ExternalId
SourceSnapshot

```

---

# 19. Proveniência dos dados

Idealmente toda entidade deveria permitir descobrir sua origem.

Por exemplo:

```http
GET /v1/propositions/:id

```

Pode retornar:

```json
{
  "id": "prop_123",

  "type": "PL",
  "number": 2338,
  "year": 2023,

  "title": "...",

  "sources": [
    {
      "provider": "senado",
      "externalId": "157233",
      "url": "..."
    }
  ]
}

```

Isso é particularmente importante para a 10xGov por se tratar de informação política.

A plataforma deve conseguir responder:

> De onde veio essa informação?

---

# 20. Neutralidade

O backend deve armazenar prioritariamente **fatos observáveis**.

Exemplo:

```text
Fulano votou SIM.

```

é um fato.

Enquanto:

```text
Fulano votou corretamente.

```

é uma avaliação.

Da mesma forma:

```text
78% dos votos de A coincidiram com B.

```

é uma métrica calculável.

Enquanto:

```text
A é aliado de B.

```

já exige interpretação/contexto.

A arquitetura deve deixar clara a separação entre:

```text
Official Data
Calculated Data
AI Generated Interpretation

```

Uma possibilidade futura é até incluir isso nas respostas:

```json
{
  "value": "SIM",
  "dataType": "official"
}

```

ou:

```json
{
  "value": 0.78,
  "dataType": "calculated"
}

```

ou:

```json
{
  "value": "...",
  "dataType": "ai_generated"
}

```

---

# 21. API + SDK

A API pode posteriormente gerar um SDK oficial.

Exemplo:

```bash
npm install @10xgov/sdk

```

Uso:

```ts
import { Gov } from "@10xgov/sdk"

const gov = new Gov()

const politician = await gov.politicians.find({
  name: "..."
})

const votes = await gov.politicians.votes(
  politician.id
)

```

Ou:

```ts
const propositions = await gov.propositions.search({
  query: "inteligência artificial"
})

```

E futuramente:

```ts
const answer = await gov.ai.ask(
  "Como os deputados de Minas votaram nessa proposta?"
)

```

---

# 22. Open Source

Existe uma oportunidade de a 10xGov não ser apenas uma aplicação open source, mas uma **infraestrutura open source de dados governamentais brasileiros**.

O repositório poderia fornecer:

```text
10xGov

├── Canonical Government Model
├── Câmara Connector
├── Senado Connector
├── TSE Connector
├── Transparency Connector
├── Database Schema
├── Sync Workers
├── REST API
├── TypeScript SDK
├── Search
└── AI / RAG

```

Isso permitiria que terceiros construíssem:

- portais de transparência;
- ferramentas jornalísticas;
- pesquisas acadêmicas;
- dashboards;
- aplicativos;
- bots;
- agentes de IA;
- ferramentas de acompanhamento político;

sem precisar implementar todas as integrações governamentais do zero.

---

# 23. Prioridade para o MVP

Não tentar implementar todo o governo brasileiro inicialmente.

Começar com:

```text
10xGov MVP

Câmara dos Deputados
        ↓
Deputados
        ↓
Proposições
        ↓
Votações
        ↓
Votos individuais

```

Primeiro objetivo:

> Conseguir responder de forma confiável como qualquer deputado federal votou em qualquer votação nominal disponível.

Depois:

```text
Fase 2
↓
Senado

Fase 3
↓
TSE

Fase 4
↓
Portal da Transparência

Fase 5
↓
Outras fontes

```

---

# 24. Primeiro vertical slice

Antes de construir dezenas de tabelas e connectors, implementar um fluxo completo:

```text
Câmara API

    ↓

Importar deputados

    ↓

Importar uma proposição

    ↓

Importar suas votações

    ↓

Importar votos individuais

    ↓

Normalizar

    ↓

Persistir no PostgreSQL

    ↓

GET /v1/politicians/:id/votes

    ↓

Interface web

    ↓

Usuário consegue visualizar:

"Como esse deputado votou?"

```

Quando esse fluxo estiver funcionando end-to-end, expandir horizontalmente.

---

# 25. Princípios técnicos

1. **Dados oficiais são a source of truth.**
2. **IA nunca é source of truth.**
3. **Preservar o raw data recebido das fontes.**
4. **Toda entidade deve ser rastreável até sua origem.**
5. **Utilizar IDs internos independentes dos IDs governamentais.**
6. **Separar Person de Mandate.**
7. **Criar um Canonical Government Model próprio.**
8. **Cada fonte externa deve ser implementada como connector/adapter.**
9. **Preferir sincronização local em vez de consultar APIs governamentais durante requests dos usuários.**
10. **Jobs devem ser idempotentes.**
11. **Começar como modular monolith.**
12. **PostgreSQL primeiro; adicionar outras infraestruturas apenas quando houver necessidade concreta.**
13. **SQL para relações e filtros estruturados; embeddings para busca semântica.**
14. **Separar dados oficiais, dados calculados e interpretações geradas por IA.**
15. **Toda resposta de IA deve fornecer evidências/fontes quando fizer afirmações factuais.**

---

# 26. Objetivo arquitetural

A arquitetura deve permitir que no futuro uma pergunta como:

> "Como os deputados de Minas Gerais votaram em projetos relacionados à regulamentação de Inteligência Artificial nos últimos quatro anos?"

possa ser resolvida aproximadamente assim:

```text
Natural Language Question
           ↓
       10xGov AI
           ↓
   Query Understanding
           ↓
      Search / SQL
           ↓
Canonical Government Model
           ↓
┌──────────┼───────────┐
│          │           │
People   Votes    Propositions
│          │           │
└──────────┼───────────┘
           ↓
     Evidence Set
           ↓
          LLM
           ↓
Answer + Citations + Official Sources

```

O ativo central da 10xGov, portanto, não precisa ser apenas o frontend.

A longo prazo, o principal ativo técnico pode se tornar:

> **Uma camada aberta, normalizada, verificável e amigável para desenvolvedores sobre os dados públicos do governo brasileiro.**

A interface web seria uma das aplicações construídas em cima dessa infraestrutura.

A API, o modelo canônico, os connectors e o SDK poderiam permitir que muitas outras aplicações fossem construídas utilizando a 10xGov como infraestrutura.