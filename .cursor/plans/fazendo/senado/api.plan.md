---
name: ""
overview: ""
todos: []
isProject: false
---

# 10xGov — Arquitetura de Ingestão de Dados

## Objetivo

A 10xGov irá consumir diferentes APIs e fontes de dados governamentais, começando pelo **Senado Federal**.

Como cada fonte possui estruturas, endpoints, formatos e particularidades diferentes, a arquitetura deve separar claramente:

```text
API Externa
    ↓
Client
    ↓
Connector
    ↓
Normalizer
    ↓
Repository
    ↓
PostgreSQL

```

Essa arquitetura deve ser implementada **desde o início**, mesmo que os primeiros endpoints sejam simples.

O objetivo é estabelecer uma fronteira clara entre:

1. comunicação HTTP;
2. conhecimento específico da fonte;
3. modelo canônico da 10xGov;
4. persistência.

A regra mental principal é:

> **Client entende HTTP.**  
> **Connector entende Senado.**  
> **Normalizer entende 10xGov.**  
> **Repository entende PostgreSQL.**

---

# 1. Visão geral

O primeiro fluxo será:

```text
                Senado Federal
                      │
                      ▼
               SenadoClient
                      │
                      ▼
              SenadoConnector
                      │
                      ▼
                 Raw Data
                      │
                      ▼
                 Normalizer
                      │
                      ▼
          10xGov Canonical Model
                      │
                      ▼
                 Repository
                      │
                      ▼
                 PostgreSQL

```

Posteriormente:

```text
Senado API ────> SenadoConnector ────┐
                                     │
Câmara API ────> CamaraConnector ────┤
                                     │
TSE ───────────> TSEConnector ───────┼──> Canonical Government Model
                                     │
Transparência ─> TransparencyConnector┤
                                     │
Outras fontes ─> OtherConnector ─────┘

```

O restante da aplicação deve trabalhar com o **Canonical Government Model**, e não com os formatos específicos das APIs externas.

---

# 2. SenadoClient

## Responsabilidade

O `SenadoClient` é responsável exclusivamente pela comunicação técnica com a API do Senado.

Pergunta que ele responde:

> **Como falar com a API do Senado?**

Ele deve cuidar de:

- Base URL;
- HTTP requests;
- headers;
- query parameters;
- timeout;
- retries;
- tratamento de status HTTP;
- erros de conexão;
- parsing de JSON;
- parsing de XML quando necessário;
- logging básico das requisições;
- eventualmente rate limiting.

Exemplo:

```ts
export class SenadoClient {
  constructor(
    private readonly baseUrl: string
  ) {}

  async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {

    const url = new URL(
      path,
      this.baseUrl
    )

    if (params) {
      Object.entries(params).forEach(
        ([key, value]) => {
          url.searchParams.set(key, value)
        }
      )
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new SenadoApiError({
        status: response.status,
        url: url.toString()
      })
    }

    return response.json()
  }
}

```

O Client **não deve**:

- criar `Person`;
- criar `Mandate`;
- saber o que é uma entidade da 10xGov;
- persistir no banco;
- decidir quais endpoints precisam ser combinados.

---

# 3. SenadoConnector

## Responsabilidade

O Connector conhece a estrutura e as regras da fonte externa.

Pergunta que ele responde:

> **Quais dados do Senado precisam ser buscados e como eles se relacionam?**

Por exemplo, para obter todas as informações necessárias sobre um senador, pode ser necessário buscar:

```text
Senador
  │
  ├── perfil
  ├── mandatos
  ├── filiações partidárias
  ├── comissões
  ├── matérias
  └── votações

```

O restante da aplicação não deve precisar saber quais endpoints do Senado fornecem essas informações.

Exemplo conceitual:

```ts
export class SenadoSenatorConnector {

  constructor(
    private readonly client: SenadoClient
  ) {}

  async getSenator(
    senatorId: string
  ): Promise<SenadoSenatorData> {

    const [
      profile,
      mandates,
      committees
    ] = await Promise.all([

      this.client.get(
        `/senador/${senatorId}`
      ),

      this.client.get(
        `/senador/${senatorId}/mandatos`
      ),

      this.client.get(
        `/senador/${senatorId}/comissoes`
      )

    ])

    return {
      profile,
      mandates,
      committees
    }
  }
}

```

---

# 4. O Connector é a fronteira com o mundo externo

O Connector deve absorver peculiaridades como:

```text
endpoint estranho
       ↓
paginação diferente
       ↓
XML
       ↓
JSON inconsistente
       ↓
campos opcionais
       ↓
múltiplas chamadas
       ↓
composição

```

E entregar para o restante do sistema algo previsível:

```text
SenadoSenatorData
SenadoPropositionData
SenadoVotingData

```

Por isso, conceitualmente, o Connector funciona como uma espécie de:

> **Anti-Corruption Layer**

A API do Senado pode mudar sem necessariamente contaminar o domínio da 10xGov.

---

# 5. Tipos externos

Os tipos retornados pela API do Senado devem ser mantidos separados dos tipos da 10xGov.

Exemplo:

```ts
export interface SenadoSenatorProfile {
  CodigoParlamentar: string
  NomeParlamentar: string
  NomeCompletoParlamentar?: string
  SexoParlamentar?: string
  FormaTratamento?: string
  SiglaPartidoParlamentar?: string
  UfParlamentar?: string
}

```

Esse tipo representa:

> **Como o Senado representa um parlamentar.**

Ele não representa:

> **Como a 10xGov representa uma pessoa.**

Essa diferença deve permanecer explícita.

---

# 6. Normalizer

## Responsabilidade

O Normalizer transforma dados específicos da fonte externa em entidades do modelo canônico da 10xGov.

Pergunta:

> **Como os dados do Senado viram dados da 10xGov?**

Entrada:

```text
SenadoSenatorData

```

Saída:

```text
Person
Mandate
Party
ExternalId
...

```

Exemplo:

```ts
export class SenadoSenatorNormalizer {

  normalize(
    data: SenadoSenatorData
  ): NormalizedSenator {

    return {

      person: {
        name:
          data.profile.NomeCompletoParlamentar ??
          data.profile.NomeParlamentar
      },

      mandate: {
        role: "senator",
        state:
          data.profile.UfParlamentar
      },

      externalId: {
        source: "senado",
        externalId:
          data.profile.CodigoParlamentar
      }

    }
  }
}

```

---

# 7. Canonical Government Model

Os Normalizers devem produzir entidades pertencentes ao domínio da 10xGov.

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
ExternalId

```

Essas entidades devem existir em:

```text
packages/gov-core/

```

O `gov-core` não deve importar absolutamente nada de:

```text
connectors/senado
connectors/camara
connectors/tse

```

A dependência deve seguir:

```text
Senado
   ↓
Connector
   ↓
Normalizer
   ↓
gov-core

```

e nunca:

```text
gov-core
   ↓
Senado

```

---

# 8. Repository

## Responsabilidade

O Repository recebe entidades da 10xGov e cuida da persistência.

Pergunta:

> **Como persistir essa entidade?**

Exemplo:

```ts
export class PersonRepository {

  async upsert(
    person: Person
  ): Promise<Person> {

    // PostgreSQL / Supabase

  }
}

```

O Repository não deve saber se o dado veio:

- do Senado;
- da Câmara;
- do TSE;
- do Portal da Transparência.

Para ele:

```text
Person = Person

```

independentemente da origem.

---

# 9. Fluxo completo

Exemplo:

```ts
const externalSenator =
  await senadoSenatorConnector.getSenator(
    senatorId
  )

const normalized =
  senadoSenatorNormalizer.normalize(
    externalSenator
  )

const person =
  await personRepository.upsert(
    normalized.person
  )

await mandateRepository.upsert({
  ...normalized.mandate,
  personId: person.id
})

await externalIdRepository.upsert({
  ...normalized.externalId,
  entityType: "person",
  entityId: person.id
})

```

Fluxo conceitual:

```text
Senado API

     ↓

SenadoClient

     ↓

SenadoSenatorConnector

     ↓

SenadoSenatorData

     ↓

SenadoSenatorNormalizer

     ↓

Person
Mandate
ExternalId

     ↓

Repositories

     ↓

PostgreSQL

```

---

# 10. Raw Data

Antes da normalização, devemos considerar persistir a resposta original da fonte.

Fluxo completo:

```text
Senado API
     ↓
Client
     ↓
Connector
     ↓
Raw Snapshot
     ↓
Normalizer
     ↓
Canonical Model
     ↓
Repository
     ↓
PostgreSQL

```

Tabela:

```text
source_snapshots

id
source
resource_type
external_id
endpoint
payload JSONB
hash
fetched_at
created_at

```

Exemplo:

```json
{
  "source": "senado",
  "resource_type": "senator",
  "external_id": "123",
  "endpoint": "...",
  "payload": {
    "...": "..."
  }
}

```

Isso permite reprocessar os dados futuramente sem necessariamente consultar novamente o Senado.

---

# 11. Separar Raw Data de Canonical Data

Devemos ter claramente:

```text
RAW

"CodigoParlamentar": "123"
"NomeParlamentar": "Fulano"
"UfParlamentar": "MG"

            ↓

       Normalizer

            ↓

CANONICAL

Person {
  id: "person_xxx"
  name: "Fulano"
}

Mandate {
  personId: "person_xxx"
  role: "senator"
  state: "MG"
}

```

O Raw representa:

> **O que a fonte disse.**

O Canonical representa:

> **Como a 10xGov entende essa informação.**

---

# 12. External IDs

Nunca utilizar o ID do Senado como ID principal das entidades da 10xGov.

Exemplo:

```text
10xGov

Person
id = "person_abc123"

```

Relacionamento:

```text
ExternalId

entity_id = "person_abc123"
source = "senado"
external_id = "123"

```

No futuro:

```text
person_abc123

├── senado: 123
├── tse: 839292
├── transparencia: 91922
└── outra_fonte: ...

```

Isso permite cruzar diferentes datasets.

---

# 13. Organização dos Connectors

Estrutura inicial:

```text
packages/

  connectors/

    senado/

      client/
        senado.client.ts
        senado.errors.ts

      senators/
        senator.connector.ts
        senator.types.ts
        senator.normalizer.ts

      propositions/
        proposition.connector.ts
        proposition.types.ts
        proposition.normalizer.ts

      voting/
        voting.connector.ts
        voting.types.ts
        voting.normalizer.ts

      committees/
        committee.connector.ts
        committee.types.ts
        committee.normalizer.ts

      parsers/
        json.parser.ts
        xml.parser.ts

      index.ts

```

---

# 14. Separação por domínio dentro do Connector

Evitar criar um único:

```text
SenadoConnector

```

com dezenas de métodos.

Preferir:

```text
SenadoSenatorConnector

SenadoPropositionConnector

SenadoVotingConnector

SenadoCommitteeConnector

```

Todos compartilham:

```text
SenadoClient

```

Assim:

```text
                     SenadoClient
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
SenatorConnector  PropositionConnector  VotingConnector
         │                │                │
         ▼                ▼                ▼
   Normalizer        Normalizer        Normalizer

```

---

# 15. Workers / Sync

A execução desse pipeline não deve acontecer necessariamente dentro de requests da API pública.

Devemos ter workers.

Exemplo:

```text
apps/

  api/
  web/
  worker/

```

O worker executa:

```text
Sync Senators Job
        ↓
Connector
        ↓
Normalizer
        ↓
Repositories

```

Exemplo:

```ts
export async function syncSenators() {

  const senators =
    await senatorConnector.list()

  for (const senator of senators) {

    const normalized =
      senatorNormalizer.normalize(
        senator
      )

    await persistSenator(
      normalized
    )
  }
}

```

---

# 16. Orquestração

Uma camada de service/job pode orquestrar o fluxo.

Exemplo:

```text
SyncSenatorsJob

      ↓

SenadoSenatorConnector

      ↓

SenadoSenatorNormalizer

      ↓

PersonRepository
MandateRepository
ExternalIdRepository

```

Assim, o Connector não persiste.

O Normalizer não persiste.

O Repository não busca dados externos.

Cada camada mantém sua responsabilidade.

---

# 17. O que cada camada NÃO pode fazer

## Client

Não deve:

```text
criar Person
persistir no banco
conhecer Mandate
executar regras de negócio

```

## Connector

Não deve:

```text
persistir no PostgreSQL
criar IDs internos
conhecer Supabase
gerar respostas de IA

```

## Normalizer

Não deve:

```text
fazer HTTP
consultar API externa
persistir
executar SQL

```

## Repository

Não deve:

```text
fazer fetch no Senado
conhecer JSON do Senado
interpretar XML
normalizar dados externos

```

## Worker / Service

Pode:

```text
orquestrar todas essas peças

```

mas deve evitar incorporar detalhes internos de cada uma.

---

# 18. Arquitetura completa

```text
                     ┌─────────────────┐
                     │  Senado Federal │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  SenadoClient   │
                     └────────┬────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Senado*Connector      │
                  │                       │
                  │ SenatorConnector      │
                  │ PropositionConnector  │
                  │ VotingConnector       │
                  └───────────┬───────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   SourceSnapshot  │
                    │      RAW DATA     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    Normalizer     │
                    └─────────┬─────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │ 10xGov Canonical Model    │
                │                           │
                │ Person                    │
                │ Mandate                   │
                │ Proposition               │
                │ VotingSession             │
                │ IndividualVote            │
                └────────────┬──────────────┘
                             │
                             ▼
                    ┌───────────────────┐
                    │   Repositories    │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    PostgreSQL     │
                    └───────────────────┘

```

---

# 19. Quando entrar Câmara

A arquitetura deve permitir adicionar:

```text
CamaraClient
     ↓
CamaraDeputyConnector
     ↓
CamaraDeputyNormalizer

```

produzindo exatamente:

```text
Person
Mandate
Party
ExternalId

```

Assim:

```text
SenadoSenatorNormalizer ────┐
                            │
                            ▼
                         Person
                            ▲
                            │
CamaraDeputyNormalizer ─────┘

```

Esse é um dos principais motivos para existir o modelo canônico.

---

# 20. Quando entrar TSE

O mesmo princípio:

```text
TSE API / Dataset
       ↓
TSEClient
       ↓
CandidateConnector
       ↓
CandidateNormalizer
       ↓
Person
Election
Candidacy
ExternalId

```

A fonte muda.

O domínio central permanece consistente.

---

# 21. Princípio de dependência

A direção das dependências deve sempre apontar para dentro:

```text
External APIs
      ↓
Clients
      ↓
Connectors
      ↓
Normalizers
      ↓
gov-core

```

O `gov-core` deve ser a parte mais independente da aplicação.

Idealmente:

```text
gov-core

```

não sabe:

- que Senado existe;
- que Câmara existe;
- que Supabase existe;
- que Next.js existe;
- que Express existe;
- que API externa existe.

Ele conhece apenas o domínio da 10xGov.

---

# 22. Regra arquitetural principal

Utilizar como regra durante o desenvolvimento:

> **Client entende protocolo.**

> **Connector entende a fonte.**

> **Normalizer entende a tradução entre a fonte e a 10xGov.**

> **gov-core entende o governo no modelo da 10xGov.**

> **Repository entende persistência.**

> **Worker/Service entende orquestração.**

---

# 23. Primeiro vertical slice

Mesmo implementando a arquitetura completa desde o início, não precisamos implementar todas as entidades.

O primeiro vertical slice deve ser pequeno:

```text
Senado
   ↓
Lista de Senadores
   ↓
SenadoClient
   ↓
SenatorConnector
   ↓
SourceSnapshot
   ↓
SenatorNormalizer
   ↓
Person + Mandate + Party + ExternalId
   ↓
Repositories
   ↓
PostgreSQL

```

Quando isso funcionar ponta a ponta:

```text
GET /v1/politicians

```

deve retornar os senadores armazenados no modelo da 10xGov.

Depois implementar:

```text
Senadores
   ↓
Proposições
   ↓
Votações
   ↓
Votos individuais

```

---

# 24. Resultado esperado

Ao final, devemos conseguir substituir:

```text
Senado

```

por:

```text
Câmara
TSE
Portal da Transparência
Assembleias Legislativas
Câmaras Municipais

```

sem alterar o núcleo da aplicação.

A arquitetura deve proteger a 10xGov das particularidades das fontes externas e permitir que todas elas alimentem um único modelo consistente de dados governamentais.

## Resumo

```text
Client
    = comunicação

Connector
    = conhecimento da fonte

Normalizer
    = tradução

gov-core
    = domínio canônico

Repository
    = persistência

Worker / Service
    = orquestração

```

Essa separação deve ser adotada desde o início do projeto.