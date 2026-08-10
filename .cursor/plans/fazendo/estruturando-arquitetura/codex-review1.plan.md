---
name: "Codex review 1 - arquitetura da 10xGov"
overview: "Parecer técnico sobre a proposta de arquitetura, com correções de domínio, recorte do MVP e plano de execução compatível com o repositório atual."
todos: []
isProject: false
---

# Codex Review 1 - Arquitetura da 10xGov

Data da revisão: 2026-08-08  
Documento revisado: `arquiteura.plan.md`  
Escopo: arquitetura, modelo de dados, ingestão, API, testes, operação e recorte do MVP.

## Veredito

**Aprovar a direção, mas não implementar o documento como está.**

O plano acerta as decisões mais difíceis de reverter: dado oficial como fonte de verdade, camada normalizada própria, preservação do raw, IDs internos, PostgreSQL primeiro, IA fora do caminho factual e monólito modular. Isso é uma base forte.

O problema é que o texto ainda é uma **visão arquitetural**, não um plano de implementação. Ele mistura o vertical slice da Câmara com a arquitetura de uma plataforma nacional, propõe uma reorganização grande do monorepo sem necessidade imediata e deixa vagas justamente as partes que mais quebram sistemas de dados: identidade, temporalidade, proveniência, relação entre votação e proposição, idempotência, reprocessamento e operação do worker.

Minha avaliação:

| Dimensão | Nota | Opinião |
|---|---:|---|
| Visão de produto técnico | 9/10 | Clara, diferenciada e coerente com a missão |
| Direção arquitetural | 8/10 | As escolhas de alto nível são boas e conservadoras |
| Modelo de domínio | 5/10 | Correto no contorno, ainda simplificado onde o Legislativo é temporal e ambíguo |
| Prontidão para implementação | 4/10 | Faltam invariantes, contratos, etapas, critérios de aceite e operação |
| Recorte do MVP | 6/10 | O objetivo é bom, mas o documento ainda carrega componentes de fases futuras |
| Estratégia de testes | 2/10 | Quase ausente para um produto cujo diferencial é confiabilidade |

**Resumo em uma frase:** mantenha os princípios, reduza a topologia, fortaleça o modelo temporal e de proveniência e transforme o primeiro vertical slice em um plano verificável.

## O que já existe no repositório

O plano não parte de uma folha em branco. Hoje já existem:

- Dois workspaces, `backend/` e `frontend/`, definidos no `package.json:5-8`.
- Backend Express seguindo `Route → Controller → Model → Database`; o domínio de usuário já serve como molde em `backend/src/index.ts:21-22` e `backend/src/{routes,controllers,models}/User*`.
- Contrato de resposta wrapped com `sendOk`/`sendError`, documentado em `.claude/CLAUDE.md:179-191`.
- Autenticação Supabase e uso server-side da service role em `backend/src/database/supabase.ts:10-29`.
- Jest nos dois workspaces, typecheck estrito e lint.
- Deploy de apenas dois artefatos, backend e frontend, em `.github/workflows/deploy.yml:57-93`.

Conclusão: a implementação deve **estender essa fundação**, não criar agora `apps/api`, `apps/web`, `apps/worker` e sete pacotes. Essa reorganização não entrega uma única votação ao usuário e aumentaria o tamanho do primeiro diff sem validar o domínio.

## Decisões do plano que eu manteria

1. **Camada própria de dados normalizados** (`arquiteura.plan.md:12-31`). A 10xGov não deve ser um proxy com nomes diferentes.
2. **Separar pessoa de exercício político** (`:97-163`). A intuição é correta, embora o modelo precise de mais temporalidade.
3. **IDs internos separados dos IDs das fontes** (`:167-212`). Essencial para cruzar fontes sem acoplar a API pública.
4. **Snapshots do dado bruto** (`:372-427`). Essencial para auditoria, replay e correção de normalizadores.
5. **Sincronização fora do request do usuário** (`:431-479`). Protege latência e disponibilidade da API pública.
6. **PostgreSQL/Supabase e busca textual antes de novos bancos** (`:743-801`). É tecnologia suficiente para o MVP.
7. **Monólito modular antes de microsserviços** (`:823-881`). A equipe precisa aprender o domínio antes de estabilizar fronteiras distribuídas.
8. **IA separada da API factual** (`:618-739`). Essa separação deve existir também em tabelas, logs, respostas e métricas.
9. **Primeiro vertical slice centrado em votos da Câmara** (`:1164-1259`). É o recorte certo para provar valor e arquitetura ao mesmo tempo.

## Achados que precisam entrar no próximo plano

### 1. [P1] O plano mistura arquitetura-alvo e primeiro incremento

**Confiança: 10/10.**

Motivação no documento: `arquiteura.plan.md:831-877` propõe `apps/api`, `apps/web`, `apps/worker`, `packages/gov-core`, connectors, AI, search e SDK; depois `:1164-1259` define um MVP somente com Câmara, deputados, proposições e votos.

O plano tenta resolver ao mesmo tempo o produto dos próximos anos e o primeiro fluxo em produção. Isso induz abstrações sem segundo consumidor, reorganização do repo e pacotes que ainda não têm contrato estável.

**Recomendação:** separar o material em dois artefatos:

- Um ADR ou documento de arquitetura-alvo, contendo princípios e decisões duráveis.
- Um plano executável do MVP Câmara, contendo somente arquivos/módulos, schema, contratos, etapas, testes, deploy e critérios de aceite do primeiro recorte.

O documento revisado continua útil como arquitetura-alvo. Ele não deve ser usado diretamente como checklist de implementação.

### 2. [P1] A topologia proposta ignora o repositório existente

**Confiança: 10/10.**

Motivação no documento: `arquiteura.plan.md:823-881` propõe outra árvore de monorepo. Motivação no código: `package.json:5-8` já define `backend` e `frontend`, enquanto `.claude/CLAUDE.md:75-79` fixa a stack e o padrão atual.

**Recomendação para o MVP:**

```text
backend/src/
├── modules/
│   ├── people/
│   ├── propositions/
│   ├── voting/
│   └── ingestion/
│       └── camara/
│           ├── client.ts
│           ├── schemas.ts
│           ├── normalizers/
│           └── jobs/
├── database/
├── middleware/
└── index.ts

frontend/
└── permanece como está
```

- Manter um único backend implantável.
- Rodar comandos de ingestão no mesmo código-base, mas fora do processo HTTP.
- Adicionar um workspace/processo `worker` somente quando houver uma forma real de implantá-lo e monitorá-lo.
- Não criar `gov-core`, `sdk`, `ai`, `search` ou pacotes por fonte antes de existir um segundo consumidor que justifique essa fronteira.

Isso preserva o monólito modular pretendido sem pagar agora o custo de uma plataforma de pacotes.

### 3. [P1] `Person` e `Mandate` não representam o tempo político suficiente

**Confiança: 9/10.**

Motivação no documento: `arquiteura.plan.md:136-157` coloca `role`, `state`, `partyId`, início e fim diretamente em `Mandate`.

Um parlamentar pode mudar de partido durante a legislatura, licenciar-se, assumir como suplente e voltar. Se `partyId` morar no mandato, consultas históricas como “qual era o partido no momento do voto?” produzirão respostas erradas ou sobrescreverão o passado.

**Recomendação:** modelar ao menos quatro conceitos:

```text
Person
  │
  └── Mandate/Term              cargo + legislatura + jurisdição
        │
        ├── PartyAffiliation    party_id + valid_from + valid_to
        └── ServicePeriod       exercício/licença/suplência + intervalo
```

Para o primeiro slice, `ServicePeriod` pode ser adiado se a fonte não trouxer informação confiável, mas `PartyAffiliation` temporal não deve ser substituída por um único `mandates.party_id`.

O voto também deve preservar o partido/UF reportado pela fonte no instante da coleta, sem tratá-lo automaticamente como verdade canônica. Isso permite auditar divergências históricas.

### 4. [P1] A relação `VotingSession → Proposition` está incorreta para a fonte escolhida

**Confiança: 10/10, verificada na documentação oficial.**

Motivação no documento: `arquiteura.plan.md:298-335` desenha várias votações abaixo de uma proposição e oferece um único `propositionId?` na votação.

A própria Câmara informa que uma votação pode ter várias proposições como “possível objeto”, que o objeto real pode não estar cadastrado e que uma votação pode afetar mais de uma proposição. Portanto, `voting_sessions.proposition_id` não comporta o dado oficial sem perda. Consulte os [arquivos oficiais de votações da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html?tab=staticfile), nas seções “Proposição objeto de cada votação” e “Proposições afetadas por votação”.

**Recomendação:** renomear `VotingSession` para `RollCall` ou `VotingEvent` e usar relação N:N explícita:

```text
RollCall
  ├── IndividualVote[]
  └── RollCallProposition[]
        ├── proposition_id
        ├── relation_type: possible_object | affected
        ├── effect_text?
        └── source_record_id
```

Não inventar qual foi o “objeto real” quando a fonte não sabe. Ambiguidade oficial deve continuar ambiguidade no modelo canônico. Esse é um caso em que normalizar não significa fabricar certeza.

Também mudaria o voto para guardar os dois valores:

```text
raw_vote_value        valor exatamente como veio da Câmara
normalized_vote       yes | no | abstention | obstruction | other
recorded_at           horário reportado pela fonte, quando houver
```

Contagens `yes/no/abstention` devem ser derivadas dos votos ou validadas contra o placar oficial; armazená-las sem regra de reconciliação cria duas fontes de verdade.

### 5. [P1] Snapshot bruto não é ainda uma cadeia de proveniência

**Confiança: 9/10.**

Motivação no documento: `arquiteura.plan.md:379-388` define apenas `source`, `endpoint`, `external_id`, `payload`, `fetched_at` e `hash`, mas `:404-427` promete auditoria e rastreamento completo.

Com essa tabela é possível saber o que foi baixado, mas não qual snapshot e qual versão do normalizador geraram cada linha canônica. Também faltam request params, paginação, status HTTP, versão do schema e identificação da execução.

**Modelo mínimo recomendado:**

```text
IngestionRun
  id, source, job_type, started_at, finished_at, status,
  cursor_before, cursor_after, code_version, error_summary

SourceSnapshot (imutável)
  id, ingestion_run_id, source, endpoint, request_params,
  http_status, fetched_at, payload_json, payload_sha256

SourceRecord
  id, snapshot_id, record_type, external_id, source_url,
  record_hash, source_updated_at

Canonical row/link
  internal id + FK para um ou mais SourceRecord
```

Para o MVP, proveniência no nível do registro é suficiente. Proveniência por campo pode ser introduzida quando duas fontes realmente disputarem o valor de um mesmo atributo.

Snapshots devem ser append-only. Um novo fetch gera uma nova revisão quando o hash muda; nunca atualiza o payload anterior.

### 6. [P1] Idempotência precisa ser uma invariante, não uma intenção

**Confiança: 10/10.**

Motivação no documento: `arquiteura.plan.md:477-479` diz “Idealmente os jobs devem ser idempotentes”.

Para este produto, idempotência é requisito de integridade. O mesmo payload será reprocessado, páginas serão repetidas, jobs vão sobrepor e a fonte poderá corrigir registros antigos.

**Recomendação:** o plano do MVP deve definir:

- Chaves naturais únicas por tipo, por exemplo `(source, external_id)` ou uma composição verificada nos fixtures.
- Hash do registro para pular revisões idênticas.
- Checkpoint/cursor salvo apenas depois de persistência bem-sucedida.
- Retry com backoff e jitter para `429`, timeout e `5xx`.
- Lease/lock para impedir duas execuções concorrentes do mesmo job.
- Transação por unidade pequena e reiniciável, não uma transação para o backfill inteiro.
- Estado explícito do job: `queued`, `running`, `succeeded`, `failed`, `partial`.
- Reconciliation job que compare contagens e detecte buracos, em vez de assumir que o incremental nunca perdeu uma página.
- Política para registros corrigidos ou removidos pela origem: histórico, `source_deleted_at` ou tombstone, nunca hard delete silencioso.

Supabase já oferece [Cron baseado em `pg_cron`](https://supabase.com/docs/guides/cron) e [Queues baseadas em `pgmq`](https://supabase.com/docs/guides/queues). São opções simples e coerentes com a stack para agendar e enfileirar o MVP. O Cron documenta limite recomendado de 8 jobs concorrentes e 10 minutos por job, então backfills longos devem ser fatiados e consumidos por worker, não executados como uma função monolítica.

### 7. [P1] O plano perde a melhor estratégia de backfill oferecida pela Câmara

**Confiança: 9/10, verificada na documentação oficial.**

O documento descreve apenas “Government API → Connector” (`arquiteura.plan.md:456-475`). A Câmara oferece tanto API REST quanto arquivos completos anuais de proposições, votações e votos, atualizados diariamente. A documentação oficial distingue consulta incremental via API e [download de conjuntos completos](https://dadosabertos.camara.leg.br/swagger/api.html?tab=staticfile).

**Recomendação:** o connector da Câmara deve ter dois modos que terminam no mesmo contrato de snapshot:

```text
BACKFILL HISTÓRICO                    INCREMENTAL
arquivos anuais oficiais              API REST da Câmara
         │                                      │
         └──────────► SourceSnapshot ◄──────────┘
                              │
                         SourceRecord
                              │
                         Normalização
```

- Arquivos anuais para preencher uma legislatura de forma reproduzível e econômica.
- REST para detalhes e atualizações recentes.
- Fixtures reais dos dois formatos alimentando os mesmos testes de contrato.

Isso reduz chamadas, tempo de backfill e dependência da disponibilidade momentânea da API.

### 8. [P1] A política atual de DDL contradiz o objetivo open source

**Confiança: 10/10.**

Motivação no repositório: `.claude/CLAUDE.md:234-247` manda aplicar DDL diretamente pela Management API e proíbe migrations SQL versionadas. Motivação do produto: `arquiteura.plan.md:1126-1160` promete schema e infraestrutura open source.

Sem histórico versionado de schema, outro contribuidor não consegue recriar o banco, revisar a evolução, rodar integração isolada nem reproduzir produção. O Git não contém a arquitetura real dos dados.

**Recomendação:** rever essa regra na fonte e adotar migrations versionadas e reproduzíveis, aplicadas pelo pipeline. Se houver razão operacional para usar a Management API, ela pode executar o conteúdo versionado, mas o SQL/manifesto que define o schema precisa morar no repositório.

Essa decisão deve ser tomada antes da primeira tabela de domínio. Corrigir depois exige arqueologia do banco.

### 9. [P2] O contrato da API ainda está ambíguo e incompleto

**Confiança: 9/10.**

Motivação no documento: `arquiteura.plan.md:539-614` expõe simultaneamente `people`, `politicians`, `voting-sessions` e `votes`, sem definir se `:id` de político é pessoa ou mandato, nem paginação, ordenação, temporalidade ou freshness.

**Recomendação:** para o MVP, usar um contrato pequeno e publicar OpenAPI antes de implementar controllers:

```http
GET /v1/people?role=federal_deputy&legislature=57&cursor=...
GET /v1/people/:personId
GET /v1/people/:personId/mandates
GET /v1/people/:personId/votes?from=...&to=...&cursor=...
GET /v1/roll-calls/:rollCallId
GET /v1/roll-calls/:rollCallId/votes?cursor=...
GET /v1/propositions/:propositionId
```

`/politicians` pode ser uma visão orientada ao produto no frontend, não uma segunda identidade na API. Se for mantido, deve ser explicitamente alias/filtro de `people`, nunca outro recurso persistido.

O contrato também precisa definir:

- Paginação por cursor e limite máximo.
- Ordenação estável com desempate pelo ID.
- Datas ISO 8601 e semântica de timezone.
- Envelope já adotado pelo repo.
- `source`, `sourceUrl`, `fetchedAt` e `dataUpdatedAt` nas respostas factuais.
- Semântica de `404`, filtros inválidos e cursor expirado.
- Cache HTTP (`ETag`/`Last-Modified`) para recursos públicos estáveis.
- Rate limit e política de API pública.

### 10. [P2] Worker e scheduler não existem na arquitetura de deploy

**Confiança: 10/10.**

Motivação no documento: `arquiteura.plan.md:431-479` depende de scheduler/jobs e `:853-856` propõe um worker. O workflow atual só constrói e implanta backend e frontend (`.github/workflows/deploy.yml:57-93`).

**Recomendação para a primeira versão:**

- Supabase Cron apenas agenda e enfileira unidades pequenas.
- Um processo worker, construído da mesma imagem/código do backend com outro comando, consome a fila.
- API HTTP nunca executa backfill e nunca depende do worker para responder leitura.
- Deploy precisa incluir o processo worker, health/liveness, variáveis, restart e logs antes que sync automático seja chamado de pronto.

Se a equipe ainda não quer operar um terceiro processo, o primeiro slice pode começar com um comando manual e idempotente de importação. Isso precisa ser marcado como fase de desenvolvimento, não como arquitetura de produção.

### 11. [P2] IA, pgvector e SDK estão cedo demais para o primeiro slice

**Confiança: 10/10.**

Motivação no documento: `arquiteura.plan.md:618-776` detalha IA e busca semântica, e `:1078-1123` descreve SDK, enquanto o critério inicial está em `:1185-1187`.

O primeiro objetivo é responder de forma confiável como um deputado votou. SQL e endpoints factuais resolvem isso. IA antes de confiabilidade e cobertura do dataset só colocaria uma interface fluente sobre dados incompletos.

**Recomendação:** deixar IA, embeddings e SDK explicitamente fora do MVP. Preparar apenas:

- Proveniência consultável.
- OpenAPI estável.
- Texto pesquisável no PostgreSQL.
- Separação clara entre dados oficiais e calculados.

Quando a API factual estiver estável e observável, o SDK pode ser gerado do OpenAPI e a IA pode consumir uma camada de evidências já confiável.

### 12. [P2] Faltam limites de segurança entre ingestão, banco e API pública

**Confiança: 8/10.**

O plano fala de API aberta e connectors, mas não especifica credenciais ou fronteiras de escrita.

**Recomendação:**

- Apenas worker e backend usam service role; navegador nunca recebe credencial privilegiada.
- Rotas públicas de leitura não expõem tabelas raw nem detalhes operacionais sensíveis.
- Endpoints de sync/replay, se existirem, são administrativos, autenticados e não aceitam URL arbitrária.
- Connectors usam allowlist de hosts, timeout, limite de payload e validação de content type.
- Raw payload deve ser tratado como conteúdo não confiável, inclusive quando futuramente entrar em contexto de LLM.
- RLS continua como defesa em profundidade, mas autorização de API fica explícita no backend.
- Rate limit, limite de paginação e limite de query evitam que a API aberta vire uma forma barata de exaurir o banco.

## Modelo conceitual recomendado para o MVP

Este é um ponto de partida, não DDL definitivo. Nomes e constraints devem ser validados contra fixtures reais antes da migration.

```text
                            ┌──────────────────┐
                            │  ingestion_runs  │
                            └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │ source_snapshots │ append-only
                            └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │  source_records  │
                            └───┬────┬────┬────┘
                                │    │    │
               ┌────────────────┘    │    └────────────────┐
               ▼                     ▼                     ▼
          people_sources      proposition_sources    roll_call_sources
               │                     │                     │
               ▼                     ▼                     ▼
            people             propositions           roll_calls
               │                     ▲                     │
               ▼                     │                     ├── individual_votes
            mandates                  └── roll_call_propositions
               │
               └── party_affiliations
```

Invariantes a registrar no schema:

- Todo registro canônico público aponta para pelo menos um `source_record`.
- `(source, record_type, external_id, record_hash)` identifica uma revisão da origem.
- Uma revisão de snapshot nunca é sobrescrita.
- Toda janela temporal satisfaz `valid_to IS NULL OR valid_to >= valid_from`.
- Relações de votação com proposição preservam o tipo de relação oficial.
- Voto normalizado nunca descarta o valor bruto.
- Upsert do mesmo source record é semanticamente neutro.

## Fluxo recomendado do MVP

```text
                         CÂMARA OFICIAL
                    ┌──────────┴──────────┐
                    │                     │
             arquivo anual             API REST
              (backfill)             (incremental)
                    │                     │
                    └──────► Connector ◄──┘
                              │
                    snapshot raw imutável
                              │
                        source records
                              │
                    normalizar + validar
                              │
                   transação + constraints
                              │
              PostgreSQL canônico + proveniência
                     │                    │
                 REST API            reconciliação
                     │                    │
                  Next.js          alertas/métricas
```

O caminho de leitura continua funcionando mesmo que Câmara, Cron ou worker estejam fora do ar. A indisponibilidade externa afeta freshness, não disponibilidade dos dados já importados.

## Recorte exato que eu adotaria

### Dentro do MVP

- Uma fonte: Câmara dos Deputados.
- Uma legislatura definida explicitamente, começando pela atual, não “todo o histórico” sem limite.
- Pessoas/deputados, mandatos, filiações partidárias necessárias aos votos.
- Proposições mínimas para contextualizar votações.
- Roll calls, relações com proposições e votos individuais.
- Backfill reproduzível e sync incremental.
- Raw snapshots, proveniência por registro e replay.
- API factual paginada.
- Uma tela: histórico de votos de um deputado com link para a origem.
- Observabilidade do pipeline: execução, contagens, falhas, duração e freshness.
- Testes de contrato, normalização, idempotência, integração e um E2E.

### NOT in scope

- Senado, TSE, Transparência e demais fontes: validar primeiro o contrato com a Câmara.
- IA/RAG e respostas em linguagem natural: dependem de dataset factual confiável.
- Embeddings/pgvector: o caso inicial é relacional e textual.
- SDK publicado: gerar depois que o OpenAPI parar de mudar rapidamente.
- Elasticsearch, MongoDB e Neo4j: nenhum gargalo medido justifica esses componentes.
- Microservices: fronteiras do domínio ainda estão sendo aprendidas.
- Reorganização para `apps/` e `packages/`: não entrega valor ao slice.
- Expenses, speeches, committees e attendance: expansão horizontal posterior.
- Resolução automática de identidade entre várias fontes: exige segunda fonte e política de merge/unmerge.
- Proveniência por campo: começar com proveniência por registro e evoluir quando houver conflito real entre fontes.

## Critérios de aceite do MVP

Substituir “qualquer deputado em qualquer votação disponível” por um critério mensurável:

1. Para a legislatura escolhida, todas as votações nominais abertas presentes no dataset oficial importado têm estado de processamento conhecido: importada, rejeitada com motivo ou aguardando retry.
2. Cada voto exibido aponta para pessoa, roll call, contexto da proposição quando disponível, raw source record e URL oficial.
3. Rodar o mesmo backfill duas vezes não altera contagens nem cria duplicatas.
4. Um normalizador novo consegue reprocessar snapshots existentes sem nova chamada à Câmara.
5. Interrupção no meio do job permite retomada sem perda ou duplicação.
6. A API continua respondendo dados persistidos quando a Câmara está indisponível.
7. A tela informa `dados atualizados em` e não apresenta ambiguidade oficial como fato certo.
8. Contagens do banco são reconciliadas com os arquivos/relatórios oficiais para o período definido.

## Estratégia de testes

O plano original não define testes. Para este produto, teste não é acabamento: é parte da prova de confiabilidade.

```text
FIXTURES OFICIAIS
  ├── [UNIT] parser aceita payload conhecido
  ├── [UNIT] normalizer preserva raw + mapeia enum
  ├── [UNIT] temporalidade escolhe filiação vigente
  ├── [UNIT] votação sem proposição permanece sem proposição
  ├── [UNIT] votação com N proposições preserva N relações
  └── [CONTRACT] mudança de shape externo falha com diagnóstico

PIPELINE
  ├── [INTEGRATION] snapshot → canonical tables
  ├── [INTEGRATION] replay gera o mesmo resultado
  ├── [INTEGRATION] segunda execução não duplica
  ├── [INTEGRATION] falha parcial mantém checkpoint correto
  ├── [INTEGRATION] revisão da origem cria histórico
  └── [INTEGRATION] constraints rejeitam referência órfã

API E USUÁRIO
  ├── [API] paginação estável e filtros válidos
  ├── [API] source/fetchedAt presentes
  ├── [API] erro segue envelope do repo
  ├── [E2E] buscar deputado → abrir histórico → abrir fonte oficial
  └── [E2E] estado vazio/indisponível é explícito e recuperável
```

Comandos esperados, respeitando a regra do repositório de executar apenas testes pertinentes:

```bash
npm test -w backend -- src/tests/camaraNormalizer.test.ts
npm test -w backend -- src/tests/ingestionPipeline.test.ts
npm test -w backend -- src/tests/voteRoutes.test.ts
npm run typecheck -w backend
npm run lint -w backend
npm run typecheck -w frontend
npm run lint -w frontend
```

### Casos mínimos que os fixtures precisam conter

- Votação nominal com `SIM`, `NÃO`, abstenção, obstrução e valor desconhecido.
- Votação sem proposição identificável.
- Votação com mais de uma possível proposição e mais de uma proposição afetada.
- Parlamentar que mudou de partido.
- Registro repetido entre páginas ou arquivos.
- Correção da origem com o mesmo ID externo e conteúdo diferente.
- Página vazia, próxima página, `429`, timeout e `5xx`.
- Data/hora ausente ou em formato inesperado.
- Payload válido com campo novo e payload inválido sem campo obrigatório.

## Falhas de produção e cobertura esperada

| Caminho | Falha realista | Teste | Tratamento | Efeito para o usuário |
|---|---|---|---|---|
| Download/API Câmara | timeout ou `429` | Integração com retry | backoff, retry, job parcial | dados antigos continuam; freshness sinaliza atraso |
| Paginação | cursor repetido ou página pulada | Integração | detector de loop + reconciliação | nenhuma ausência silenciosa |
| Snapshot | payload grande/corrompido | Unit + integração | limite, hash e estado failed | sem publicação parcial |
| Normalização | enum novo de voto | Contract + unit | preservar raw, mapear `other`, alertar | voto não some nem vira valor falso |
| Upsert | job executado duas vezes | Integração | unique constraints + hash | contagens não duplicam |
| Relação legislativa | votação tem múltiplos objetos | Unit + integração | N:N com tipo oficial | UI mostra contexto e incerteza corretos |
| Filiação | partido mudou no período | Unit | intervalo temporal | partido exibido no voto histórico é correto |
| Worker | processo morre no meio | Integração | lease expira, retomada por checkpoint | atraso explícito, sem corrupção |
| API | query ampla demais | API/performance | limite e cursor | resposta previsível, sem exaurir banco |
| Fonte fora do ar | sync falha por horas | E2E operacional | servir último dado válido | API disponível com aviso de atualização |

Qualquer caminho que engula registro inválido, avance cursor e não emita métrica é gap crítico, porque gera ausência silenciosa. Para a 10xGov, dado faltante sem indicação é pior que erro explícito.

## Performance e operação

Não adicionaria cache distribuído ou mecanismo externo de busca no MVP. Faria o básico corretamente:

- Índices compostos a partir das queries reais: votos por pessoa/data, votos por roll call, proposições por tipo/número/ano e source keys.
- Paginação keyset/cursor, nunca `OFFSET` alto em históricos grandes.
- Backfills em lotes pequenos com concorrência configurável.
- `EXPLAIN ANALYZE` registrado para os endpoints principais antes do lançamento.
- Payload raw fora das respostas públicas e selecionado apenas por jobs administrativos.
- Métricas: runs por status, registros lidos/gravados/rejeitados, retries, duração, lag/freshness e divergências da reconciliação.
- Logs sempre com `ingestion_run_id`, `snapshot_id`, source e external ID, sem payload completo.

Se JSONB de snapshots começar a dominar tamanho, backup ou I/O do banco, mover payloads grandes para object storage mantendo hash e metadados no PostgreSQL. Não anteciparia essa mudança sem medir.

## Sequência de implementação recomendada

### Fase 0 - Descoberta contratual

- Baixar pequenos fixtures oficiais de deputados, proposições, votações, objetos/afetadas e votos.
- Documentar campos, nulabilidade, paginação e relações observadas.
- Fixar a legislatura/período do MVP.
- Escrever ADRs curtos para proveniência, relação N:N de votação e estratégia de schema.

Validação: fixture corpus revisado e critérios de aceite aprovados.

### Fase 1 - Schema reproduzível

- Criar migrations versionadas das tabelas de ingestão e domínio.
- Criar constraints, índices e tipos TypeScript gerados/derivados do schema.
- Escrever testes de integração do schema e das invariantes.

Validação: banco vazio sobe do zero e aceita/rejeita os casos previstos.

### Fase 2 - Backfill mínimo end-to-end

- Implementar download de um arquivo/recorte oficial.
- Persistir snapshot imutável e source records.
- Normalizar pessoas, proposições, roll calls e votos.
- Provar replay e idempotência.

Validação: duas execuções produzem as mesmas contagens e relações.

### Fase 3 - API factual

- Publicar OpenAPI do recorte.
- Implementar rotas pequenas sobre o envelope atual.
- Adicionar paginação, proveniência, freshness, validação e testes.

Validação: consulta completa do voto até a fonte oficial.

### Fase 4 - Interface vertical

- Listar/buscar deputado.
- Mostrar votos com contexto, data, partido histórico e link oficial.
- Tratar vazio, atraso e ambiguidade.

Validação: E2E real “deputado → voto → fonte”.

### Fase 5 - Incremental e operação

- API REST incremental, fila, retry, checkpoint, lock e reconciliação.
- Deploy do worker/processo de ingestão.
- Dashboard/logs/alertas de freshness.

Validação: interromper e retomar job; simular fonte indisponível; manter API de leitura saudável.

## Dependências e paralelização

| Etapa | Módulos tocados | Depende de |
|---|---|---|
| Fixtures + contratos da Câmara | `backend/src/modules/ingestion/camara/`, `docs/` | - |
| Schema + proveniência | banco/Supabase, tipos do backend | Fixtures |
| Connector/backfill | ingestão Câmara | Schema |
| API/OpenAPI | people, voting, propositions, routes | Schema |
| UI vertical | frontend app/services/types | OpenAPI |
| Incremental/worker | ingestion jobs, deploy | Connector/backfill |
| Reconciliação/observabilidade | ingestion jobs, operação | Connector/backfill |

Lanes recomendadas:

- **Lane A:** fixtures → schema → connector/backfill → incremental/worker.
- **Lane B:** depois do schema, OpenAPI/API pode avançar em paralelo ao connector usando fixtures persistidas.
- **Lane C:** depois do OpenAPI, frontend pode avançar com contrato/mock em paralelo ao backend.
- **Lane D:** reconciliação e observabilidade podem avançar após a forma do pipeline estabilizar.

Execução: Fase 0 é sequencial e bloqueia o resto. Depois do schema, lançar A + B. Depois do OpenAPI, lançar C. Lane D acompanha a estabilização do pipeline. Evitar branches paralelas alterando as mesmas migrations.

## Decisões que ainda precisam de dono

Antes de implementar, registrar respostas explícitas para:

1. Qual legislatura e intervalo temporal definem a completude do MVP?
2. Migrations versionadas entrarão no repositório? Minha recomendação é **sim**.
3. O MVP usará arquivos anuais para backfill e REST para incremental? Minha recomendação é **sim**.
4. O termo público será `roll-call`, `voting-event` ou `voting-session`? Minha recomendação é `roll-call` internamente e copy em português na UI.
5. O primeiro deploy automático já inclui worker, ou o primeiro import será comando manual? Minha recomendação é comando manual apenas no primeiro slice e worker obrigatório antes de sync contínuo.
6. A API factual será pública sem login? Minha recomendação é leitura pública com rate limit; administração e ingestão privadas.
7. Senado continua fora do MVP apesar de o README listar Câmara e Senado como fontes iniciais? Minha recomendação é **sim**, até o contrato da Câmara estar provado.

## Implementation Tasks

- [ ] **T1 (P1)** - Separar arquitetura-alvo do plano executável do MVP Câmara.
  - Verificar: novo plano contém arquivos, fases, validações e critérios mensuráveis.
- [ ] **T2 (P1)** - Construir corpus de fixtures oficiais e documentar contratos observados.
  - Verificar: inclui voto incomum, votação ambígua, paginação e revisão da origem.
- [ ] **T3 (P1)** - Definir schema temporal e proveniência com migrations reproduzíveis.
  - Verificar: banco vazio sobe do zero e todas as invariantes têm teste.
- [ ] **T4 (P1)** - Implementar relação N:N entre roll calls e proposições.
  - Verificar: zero, uma e múltiplas relações não perdem informação.
- [ ] **T5 (P1)** - Implementar pipeline append-only, replayável e idempotente.
  - Verificar: duas execuções e uma retomada após falha geram o mesmo estado canônico.
- [ ] **T6 (P2)** - Publicar OpenAPI factual pequeno, paginado e com proveniência/freshness.
  - Verificar: testes de contrato do envelope, filtros, erros e cursores.
- [ ] **T7 (P2)** - Entregar a tela vertical de votos por deputado.
  - Verificar: E2E chega do deputado ao registro e à fonte oficial.
- [ ] **T8 (P2)** - Implantar worker, reconciliação e observabilidade antes do sync contínuo.
  - Verificar: falha/retry/lag são visíveis e não derrubam a API pública.
- [ ] **T9 (P3)** - Revisitar SDK, IA e busca semântica depois da estabilização factual.
  - Verificar: decisão baseada em uso real e contrato OpenAPI estável.

## Opinião final

A tese arquitetural é boa e vale preservar. O maior risco não é escolher PostgreSQL, Express ou Supabase. É modelar certeza onde a fonte oficial contém ambiguidade e chamar um pipeline “idempotente” sem tornar isso verificável no banco e nos testes.

Eu começaria menor na topologia e mais completo na integridade. Um backend, um banco, um connector, um período definido, uma tela e um caminho de evidência impecável. Se esse caminho funcionar com replay, correções da fonte, votação sem objeto certo e mudança de partido, a 10xGov terá encontrado a fundação certa para crescer. Os pacotes, o SDK, a IA e novas fontes ficam bem mais fáceis depois disso.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Escopo e estratégia | 0 | Não executada | Fora deste parecer |
| Codex Review | pedido direto | Segunda opinião independente | 1 | Concluída com ressalvas | 12 achados, 8 tarefas P1/P2 |
| Eng Review | `/plan-eng-review` | Arquitetura e testes | 1 | Issues open | 12 achados, 0 gaps silenciosos aceitos |
| Design Review | `/plan-design-review` | UI/UX | 0 | Não executada | UI ainda não desenhada neste plano |
| DX Review | `/plan-devex-review` | Experiência de desenvolvimento | 0 | Não executada | Fora deste parecer |

**VERDICT:** DIREÇÃO APROVADA; REVISÃO DO PLANO NECESSÁRIA ANTES DE IMPLEMENTAR.

**UNRESOLVED DECISIONS:**

- As sete decisões listadas em “Decisões que ainda precisam de dono” permanecem abertas.
