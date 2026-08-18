---
name: "Arquitetura evolutiva: catálogo, integrações e domínios"
overview: "Evolução da arquitetura da 10xGov depois do mapeamento de fontes e da validação de planilhas, JSON e demonstrativos do Senado. Preserva os princípios originais, mas separa catálogo, ingestão e modelos canônicos por domínio."
todos: []
isProject: false
---

# Arquitetura evolutiva: catálogo, integrações e domínios

Data: 2026-08-10  
Complementa: `arquiteura.plan.md` e `codex-review1.plan.md`  
Motivação: o roadmap agora contém fontes legislativas, financeiras, administrativas, eleitorais, documentais, estatísticas, judiciais e de controle.

## Veredito

**A arquitetura original se mantém nos princípios, mas não no desenho de um único modelo canônico para todo o governo.**

Continuam corretos:

- dado oficial como fonte de verdade;
- IDs internos separados dos identificadores oficiais;
- proveniência e preservação do dado bruto;
- connectors por fonte;
- sincronização fora do caminho da API pública;
- PostgreSQL/Supabase primeiro;
- monólito modular;
- API factual separada de IA;
- vertical slices antes de expansão horizontal.

O que muda depois do mapeamento:

1. O catálogo de fontes passa a ser uma camada permanente do produto, não uma tela temporária.
2. Nem todo conjunto mapeado será imediatamente copiado e normalizado.
3. O modelo canônico deixa de ser um esquema universal e vira um núcleo compartilhado com modelos por domínio.
4. Connectors são definidos por `fonte + conjunto`, porque um mesmo órgão publica APIs, arquivos tabulares, relatórios e documentos com contratos diferentes.
5. Bytes brutos grandes pertencem a object storage; PostgreSQL guarda metadados, hashes, proveniência e dados normalizados.
6. Preview sob demanda é uma capacidade do catálogo, não o caminho de leitura da futura API factual.

## Evidência que provocou a revisão

O plano original imagina principalmente:

```text
Person → Mandate → Proposition → RollCall → Vote
```

O roadmap já exige também:

```text
Orçamento        → dotações, receitas, execução, demonstrativos
Contratações     → licitação, contrato, aditivo, item, fornecedor
Eleições         → eleição, candidatura, resultado, prestação de contas
Publicações      → ato, documento, seção, versão, trecho
Indicadores      → série, observação, período, geografia, unidade
Judiciário       → processo, decisão, pauta, órgão julgador
Controle externo → auditoria, achado, responsável, acórdão
```

Forçar tudo isso em `Person`, `Mandate`, `Proposition`, `Event` e `Expense` produziria uma tabela genérica demais, muitos campos nulos e semântica escondida em strings.

O código atual também provou duas formas legítimas de acesso:

- `DataCatalogController.preview` busca um arquivo oficial no momento em que o usuário pede uma amostra.
- O plano de ingestão pretende persistir snapshots e servir dados canônicos sem consultar o órgão durante a request.

Essas formas não competem. Elas pertencem a camadas distintas.

## Arquitetura-alvo revisada

```text
                              FONTES OFICIAIS
              API | CSV | JSON | XLSX | XML | XBRL | documentos
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │ Source Registry        │
                         │ catálogo + roadmap     │
                         │ origem + contrato      │
                         │ maturidade + freshness │
                         └───────────┬────────────┘
                                     │
                ┌────────────────────┼─────────────────────┐
                │                    │                     │
                ▼                    ▼                     ▼
        Catálogo somente      Preview sob demanda      Ingestão durável
        link + metadados      fetch + parser +         snapshot + replay +
                              renderer                 normalização
                │                    │                     │
                └──────────────┬─────┘                     ▼
                               │               ┌─────────────────────────┐
                               │               │ Canonical Shared Kernel │
                               │               │ proveniência, órgãos,   │
                               │               │ identidades, tempo, geo │
                               │               └────────────┬────────────┘
                               │                            │
                               │        ┌───────────────────┼──────────────────┐
                               │        ▼                   ▼                  ▼
                               │   Legislativo       Finanças/Compras    Outros domínios
                               │        │                   │                  │
                               └────────┴───────────────────┴──────────────────┘
                                                        │
                                                        ▼
                                           API factual + busca + UI
                                                        │
                                                        ▼
                                                IA com evidências
```

## 1. Source Registry como fonte de verdade editorial

O registry descreve o que existe, o que a 10xGov sabe fazer e o que falta. Ele não armazena os dados governamentais em si.

Contrato conceitual:

```ts
interface SourceDefinition {
  id: string
  publisher: string
  sourceSystem?: string
  title: string
  officialUrl: string
  domain: DataDomain
  access: AccessMethod[]
  maturity: IntegrationMaturity
  freshnessPolicy?: FreshnessPolicy
  artifacts: ArtifactDefinition[]
  nextStep?: string
}
```

Maturidade interna recomendada:

```text
discovered  fonte ou tema priorizado
mapped      contrato oficial e URLs identificados
previewable metadados, download e preview funcionam
mirrored    bytes brutos são preservados pela 10xGov
normalized dados canônicos e proveniência estão disponíveis
productized API/tela têm SLO, reconciliação e observabilidade
```

A interface pode continuar resumindo isso em `Disponível`, `Mapeado` e `A mapear`. O backend precisa do estado mais preciso para orientar implementação e operação.

### Decisão de armazenamento do registry

Começar como configuração TypeScript versionada, validada em teste e servida pelo backend.

Não criar editor administrativo nem tabela no banco enquanto a curadoria continuar sendo feita por desenvolvedores via pull request. Migrar para banco somente quando pessoas não técnicas precisarem editar o catálogo ou quando houver coleta automática frequente.

### Remover a duplicação atual

Hoje existem duas fontes de verdade:

- `backend/src/models/DataCatalogModel.ts` para itens disponíveis;
- `frontend/lib/dataSourceRoadmap.ts` para disponíveis e futuros.

O próximo passo deve unificá-las no backend. A UI consome um único contrato e não mantém URLs, status ou descrições oficiais em paralelo.

## 2. Três políticas de integração, escolhidas por conjunto

Cada conjunto escolhe o nível necessário. “Entrar na plataforma” não significa sempre copiar tudo para o banco.

### Política A: catálogo

Usar quando o primeiro valor é descoberta e acesso à fonte.

```text
registry → metadados → link oficial
```

Exemplos iniciais: fontes ainda em descoberta, como tribunais superiores.

### Política B: preview

Usar para arquivos públicos em que reconhecer estrutura e conteúdo já entrega valor.

```text
file id → URL allowlisted → fetch limitado → parser → preview DTO → renderer
```

Exemplos atuais: receitas, despesas e demonstrações contábeis do Senado.

Regras:

- URL resolvida somente pelo registry;
- allowlist de host por fonte;
- timeout, limite de bytes, redirect e content type explícitos;
- parser selecionado pela definição do artefato;
- cache curto e condicional com `ETag`/`Last-Modified` quando a origem oferecer;
- erro da origem aparece como indisponibilidade do preview, sem apagar o download oficial;
- esta rota nunca é usada como base da API factual normalizada.

### Política C: ingestão e normalização

Usar quando a 10xGov precisa consultar, cruzar, historizar, buscar ou responder sem depender da origem.

```text
connector → artifact/snapshot → source record → normalizer → domínio → API
```

Exemplos prioritários: deputados, proposições, votações e votos individuais.

Regras:

- snapshots imutáveis;
- replay sem nova chamada externa;
- idempotência garantida por constraints e testes;
- estado de processamento conhecido para todo registro;
- proveniência consultável;
- freshness explícita;
- reconciliação contra a fonte.

## 3. Canonical Shared Kernel + modelos por domínio

O `gov-core` original não deve conter todas as entidades do governo. O núcleo compartilhado deve ser pequeno e semanticamente estável.

### Núcleo compartilhado

```text
Source                órgão/sistema publicador
Dataset               conjunto oficial
Artifact              arquivo, endpoint ou recurso
SourceRecord          registro/revisão da origem
ProvenanceLink        ligação do canônico à evidência
Organization          órgão ou unidade organizacional
Geography             país, UF, município e códigos oficiais
IdentityReference     identificador externo e decisão de vínculo
TimeRange             vigência e competência
IngestionRun          execução, estado, cursor e métricas
```

O núcleo não deve conhecer `Senado`, `Câmara`, `TSE`, `SIAFI` ou `PNCP` por enum fechado. Essas são instâncias do registry.

### Domínios delimitados

```text
legislative/
  people, mandates, affiliations, propositions, proceedings,
  sessions, roll_calls, votes, committees, speeches

public_finance/
  budgets, appropriations, revenues, executions,
  statements, accounts, transfers, amendments

procurement/
  procurement_processes, notices, bids, awards,
  contracts, amendments, items, suppliers

elections/
  elections, contests, candidacies, results,
  parties, campaign_accounts

publications/
  publications, issues, sections, acts, documents, versions

statistics/
  series, observations, indicators, geographies, units

justice_and_control/
  cases, decisions, sessions, audits, findings, rulings
```

Domínios podem compartilhar referências, mas não suas tabelas principais. `Party` eleitoral e `PartyAffiliation` legislativa podem apontar para a mesma organização sem virar a mesma entidade operacional.

### Regra para promover algo ao núcleo

Uma abstração só entra no shared kernel quando:

1. pelo menos dois domínios reais precisam dela;
2. a semântica é a mesma nos dois;
3. fixtures oficiais provam o contrato;
4. a extração reduz duplicação sem esconder diferenças importantes.

Até isso acontecer, a entidade fica no domínio que a descobriu.

## 4. Connectors por fonte e conjunto

Um connector apenas por órgão é uma fronteira grande demais. O Senado sozinho já contém Arquimedes, SIAFI, API legislativa, CSV, JSON, iCal e relatórios contábeis.

Estrutura incremental dentro do monorepo atual:

```text
backend/src/modules/
├── catalog/
│   ├── registry.ts
│   ├── schemas.ts
│   └── preview/
│       ├── fetcher.ts
│       ├── parserRegistry.ts
│       └── parsers/
├── integrations/
│   ├── senado/
│   │   ├── common/
│   │   ├── orcamento/
│   │   │   ├── receitas/
│   │   │   ├── despesas/
│   │   │   └── demonstracoes/
│   │   └── legislativo/
│   └── camara/
│       └── legislativo/
└── domains/
    ├── shared/
    ├── legislative/
    ├── publicFinance/
    └── procurement/
```

Não mover agora o projeto para `apps/` e `packages/`. A topologia `backend/` e `frontend/` continua correta. Extrair pacote somente quando existir um segundo consumidor concreto.

Cada integração pode fornecer, conforme a maturidade:

```text
definition   metadados e política
client       transporte específico
parser       bytes/payload → representação fiel
normalizer   representação fiel → domínio canônico
fixtures     amostras oficiais versionadas
reconciler   prova de cobertura/completude
```

Não exigir arquivos vazios para capacidades que o conjunto ainda não possui.

## 5. Raw data para APIs e arquivos

O plano original propõe `payload JSONB`. Isso serve para respostas pequenas de API, mas não para todo o cardápio.

Estratégia revisada:

```text
PostgreSQL
  ingestion_runs
  source_artifacts
  source_records
  provenance_links
  canonical domain tables

Object Storage
  CSV, JSON, XLSX, XML, XBRL, PDF e payloads grandes
  chave content-addressed pelo SHA-256
```

`source_artifacts` guarda:

```text
id, dataset_id, source_url, media_type, byte_size, sha256,
storage_key, fetched_at, source_updated_at, etag, last_modified,
ingestion_run_id, status, error_code
```

Payload pequeno pode continuar em JSONB. O critério de corte deve ser medido e configurável, não codificado no domínio.

## 6. API por capacidade e por domínio

Separar contratos:

```text
/data-sources/*                 catálogo e preview
/v1/legislative/*               dados normalizados legislativos
/v1/public-finance/*            dados normalizados financeiros
/v1/procurement/*               compras e contratos normalizados
/v1/elections/*                 dados eleitorais normalizados
/v1/statistics/*                séries e observações normalizadas
/v1/ai/*                        interpretações com evidências
```

Não criar um endpoint genérico `/v1/entities` nem expor diretamente snapshots brutos.

O contrato público de cada domínio precisa incluir:

- paginação e ordenação estáveis;
- datas, competência e timezone explícitos;
- `source`, `sourceUrl`, `fetchedAt` e `dataUpdatedAt`;
- indicação de dado oficial, calculado ou gerado;
- freshness e cobertura conhecidas;
- erros no envelope já adotado pelo backend.

## 7. Relação com a implementação atual

Nada do que já funciona precisa ser descartado.

### Reaproveitar

- `DataCatalogModel` como semente do registry unificado;
- `fetchSourceFile` como primeiro transport do preview, mantendo a exceção TLS isolada por host;
- `parseSpreadsheet` e `parseFinancialReport` como primeiros parsers registrados;
- `FilePreview` discriminado por layout;
- `DataCatalogController` e suas rotas;
- testes de fetch, parsing, catálogo e viewer;
- frontend de Sumário/Dados como primeira interface do Source Registry.

### Evoluir

- mover o roadmap do frontend para o registry servido pelo backend;
- separar `format` de `layout` e de `parser`;
- ampliar layouts somente quando um conjunto real exigir: `document`, `timeseries`, `eventLog`, `geospatial`;
- trocar branches do controller por parser registry quando existir o terceiro layout;
- adicionar limite de bytes e política de redirects ao fetcher;
- adicionar cache condicional antes de aumentar tráfego ou número de usuários;
- persistir raw apenas nos conjuntos promovidos a `mirrored` ou `normalized`.

### Não confundir

O total calculado sobre uma planilha para o preview não transforma aquela planilha em um domínio financeiro normalizado. É uma derivação de apresentação, útil e auditável, mas ainda ligada à estrutura daquele artefato.

## 8. Segurança e confiança

- Browser nunca recebe service role nem chama origens sem CORS diretamente.
- Preview só resolve URLs cadastradas; request nunca informa URL arbitrária.
- Hosts, redirects e protocolos são allowlisted.
- Limites de tempo e bytes existem por artefato.
- MIME e assinatura dos bytes são validados antes do parser.
- Raw oficial é conteúdo não confiável: não executa fórmulas, HTML, links ou instruções.
- Fórmulas de XLSX nunca são avaliadas.
- Endpoints de ingestão, replay e reconciliação são administrativos.
- API pública normalizada não expõe payload raw por padrão.
- Logs não carregam payload, tokens ou dados pessoais completos.
- Gestão de pessoas exige revisão específica de privacidade antes de sair de `mapped`.

## 9. Testes e prova de confiabilidade

```text
REGISTRY
  ├── [UNIT] ids e URLs oficiais são válidos e únicos
  ├── [UNIT] maturidade é compatível com capacidades declaradas
  ├── [UNIT] item previewable declara parser e layout
  └── [API] backend e frontend recebem o mesmo roadmap

PREVIEW
  ├── [UNIT] CSV/JSON/XLSX e encoding conhecido
  ├── [UNIT] relatório preserva metadados e estrutura
  ├── [UNIT] limite de linhas não altera total global
  ├── [SECURITY] URL fora da allowlist é rejeitada
  ├── [SECURITY] redirect para host externo é rejeitado
  ├── [SECURITY] payload acima do limite é interrompido
  ├── [INTEGRATION] timeout/4xx/5xx viram erro recuperável
  └── [UI] usuário ainda pode abrir a fonte quando preview falha

INGESTION
  ├── [CONTRACT] fixtures detectam mudança da origem
  ├── [INTEGRATION] artifact → source records → domínio
  ├── [INTEGRATION] replay produz o mesmo estado
  ├── [INTEGRATION] segunda execução não duplica
  ├── [INTEGRATION] correção da fonte cria revisão
  ├── [INTEGRATION] falha parcial retoma do checkpoint
  └── [RECONCILIATION] contagens e lacunas são conhecidas

API E PRODUTO
  ├── [API] paginação, filtros, freshness e proveniência
  ├── [E2E] catálogo → preview → fonte oficial
  ├── [E2E] entidade normalizada → evidência oficial
  └── [E2E] origem indisponível não derruba dado persistido
```

## 10. Falhas de produção

| Caminho | Falha realista | Tratamento | Efeito visível |
|---|---|---|---|
| Registry | URL oficial mudou | validação e revisão do item | status degradado, sem redirecionamento silencioso |
| Preview | origem lenta ou fora do ar | timeout e erro recuperável | download oficial permanece disponível |
| Preview | arquivo cresceu demais | limite de bytes | preview indisponível, sem exaurir memória |
| Parser | órgão alterou encoding/colunas | contract test + diagnóstico | não publica total parcial incorreto |
| Cache | conteúdo antigo | ETag/TTL + data da coleta | freshness exibida |
| Ingestão | página repetida ou pulada | idempotência + reconciliação | lacuna alertada, não silenciosa |
| Normalização | enum novo | preservar raw + `other` + alerta | dado não desaparece |
| Object storage | upload falha após download | estado parcial reiniciável | snapshot não é marcado como pronto |
| Identidade | duas pessoas parecidas | link explícito e reversível | não faz merge automático destrutivo |
| API | query ampla | cursor, limites e índices | erro previsível em vez de exaustão |

Gap crítico: qualquer registro descartado sem estado, métrica e motivo consultável.

## 11. Performance e operação

- Sem Redis, Elasticsearch, Kafka ou microsserviços no primeiro ciclo.
- Preview trabalha em streaming até o limite de bytes; evitar buffer ilimitado.
- Cache HTTP/objeto é por hash e metadados da origem.
- Backfills são fatiados e reiniciáveis.
- API normalizada usa paginação por cursor.
- Índices surgem das queries reais de cada domínio.
- Métricas mínimas: requests de preview, latência da origem, bytes, cache hit, parse failures, freshness, runs, registros processados/rejeitados e divergências.
- A indisponibilidade de uma origem reduz freshness; não derruba o catálogo nem a API persistida.

## 12. Sequência de implementação

### Fase 0: registrar a decisão

- Aprovar `Source Registry + Shared Kernel + Bounded Domains`.
- Manter `arquiteura.plan.md` como visão histórica e este documento como evolução.
- Registrar ADRs curtos para maturidade, raw storage e fronteiras de domínio.

Validação: decisões têm exemplos e contraexemplos reais do roadmap.

### Fase 1: unificar catálogo e roadmap

- Criar contrato do registry no backend.
- Migrar os 25 itens do roadmap para uma única fonte de verdade.
- Fazer `/data-sources` devolver itens disponíveis e planejados com maturidade.
- Remover dados editoriais duplicados do frontend.
- Preservar a aba Dados como principal e Sumário como visão do roadmap.

Validação: alterar título/status/URL em um único arquivo atualiza ambas as abas; testes impedem IDs e URLs inválidos.

### Fase 2: tornar o preview extensível e limitado

- Separar formato, layout e parser.
- Introduzir parser registry quando entrar o próximo layout real.
- Implementar limite de bytes, redirect seguro, MIME e assinatura.
- Definir cache condicional/TTL sem Redis.
- Manter fixtures dos três conjuntos atuais.

Validação: adicionar um novo CSV tabular não exige editar controller ou viewer; origem malformada não produz resultado parcial enganoso.

### Fase 3: primeiro domínio normalizado

- Manter a recomendação de `codex-review1`: Câmara, deputados, proposições, roll calls e votos.
- Implementar shared kernel mínimo somente com conceitos usados pelo slice.
- Persistir raw, source records, domínio legislativo e proveniência.
- Entregar API factual e tela vertical com evidência.

Validação: backfill, replay, idempotência, freshness, reconciliação e E2E completos.

### Fase 4: provar uma segunda família de domínio

- Escolher entre `public_finance` e `procurement` conforme prioridade de produto.
- Reutilizar apenas conceitos do shared kernel cuja semântica realmente coincida.
- Revisar se alguma abstração merece promoção ao núcleo.

Validação: segundo domínio entra sem alterar tabelas legislativas nem criar entidade genérica sem significado.

### Fase 5: automação e escala editorial

- Automatizar verificações de disponibilidade/freshness do registry.
- Mover curadoria para banco apenas se houver editor não técnico.
- Extrair pacotes somente quando houver segundo consumidor.
- Avaliar busca semântica e IA sobre a API factual estabilizada.

## 13. Critérios de aceite arquiteturais

1. Um item `mapped` pode ser adicionado sem criar parser, tabela ou renderer.
2. Um item `previewable` aponta para URL allowlisted e declara formato, layout e parser.
3. Falha do preview não remove metadados nem o link da fonte.
4. Nenhuma API factual depende de request em tempo real ao órgão.
5. Todo dado normalizado público aponta para evidência oficial persistida.
6. Um domínio novo não exige alterar tabelas internas de outro domínio.
7. Shared kernel não contém enums fechados de órgãos ou tipos específicos de uma fonte.
8. Raw grande fica fora de JSONB, com hash e metadados no PostgreSQL.
9. Registry, ingestão e apresentação têm contratos diferentes e nomes explícitos.
10. Adicionar um terceiro layout não aumenta branches no controller central.
11. Jobs normalizados são replayáveis, idempotentes e reconciliáveis.
12. UI informa origem, atualização, cobertura e limitações relevantes.

## 14. O que já existe

- Catálogo curado de três conjuntos e 40 arquivos do Senado.
- Download oficial e preview server-side sem CORS.
- Parsers tabular e de demonstrativo contábil.
- Totais calculados sobre o arquivo inteiro para colunas explicitamente conhecidas.
- Roadmap com 25 itens e links oficiais.
- Testes de transporte, parsing, catálogo, busca e viewer.
- Backend Express, frontend Next.js e Supabase no monorepo atual.

Tudo isso é reaproveitado; não há reescrita.

## 15. NOT in scope

- Implementar agora os 25 itens: o registry documenta maturidade, não promete ingestão imediata.
- Criar um banco universal com uma tabela `entities`: perde semântica e integridade.
- Migrar o monorepo para `apps/` e `packages/`: não há segundo consumidor.
- Microsserviços por órgão ou domínio: fronteiras ainda estão sendo aprendidas.
- Redis/Kafka/Elasticsearch: nenhum gargalo medido pede essa infraestrutura.
- Editor administrativo do catálogo: curadoria por código ainda é suficiente.
- Proveniência por campo: proveniência por registro primeiro.
- Merge automático de pessoas entre órgãos: deve ser explícito e reversível.
- IA/RAG antes da primeira API factual reconciliada.
- Normalizar demonstrativos contábeis apenas porque o preview funciona.

## 16. Dependências e paralelização

| Etapa | Módulos | Depende de |
|---|---|---|
| Registry unificado | backend catalog, frontend fonte de dados | - |
| Segurança/cache do preview | backend catalog/preview | registry |
| Fixtures e contratos da Câmara | integrations/camara, docs | - |
| Shared kernel mínimo | database, domains/shared | fixtures Câmara |
| Domínio legislativo | domains/legislative, integrations/camara | shared kernel |
| API/UI legislativa | routes/controllers, frontend | domínio legislativo |

Lanes:

- Lane A: registry unificado → preview seguro.
- Lane B: fixtures Câmara → shared kernel → domínio legislativo.
- Lane C: API/UI legislativa depois do contrato do domínio.

Lane A e a descoberta inicial da Lane B podem avançar em paralelo. Evitar que duas lanes alterem as mesmas migrations.

## 17. Decisões ainda abertas

1. **Primeiro domínio normalizado:** manter Câmara/votos, conforme o plano anterior, ou normalizar finanças do Senado primeiro? Recomendação: Câmara/votos; o preview financeiro já entrega valor sem exigir modelo canônico imediato.
2. **Cache do preview:** object storage com metadados no PostgreSQL ou somente revalidação HTTP no início? Recomendação: revalidação HTTP para arquivos pequenos; promover a mirrored quando houver necessidade de replay ou confiabilidade.
3. **Segundo domínio:** `public_finance` ou `procurement`? Decidir por pergunta de produto, não por facilidade da API.
4. **Registry em banco:** adiar até existir editor não técnico ou coleta automatizada que justifique escrita fora de deploy.

## Implementation Tasks

- [ ] **T1 (P1, human: ~1 dia / Codex: ~1h)** — Arquitetura — Aprovar shared kernel + bounded domains.
  - Origem: o roadmap contém formatos e semânticas incompatíveis com um modelo universal.
  - Arquivos: ADR novo e este plano.
  - Verificar: critérios 1 a 9 têm exemplos reais.
- [ ] **T2 (P1, human: ~2 dias / Codex: ~3h)** — Catálogo — Unificar registry e roadmap no backend.
  - Origem: dados editoriais duplicados entre backend e frontend.
  - Arquivos: `backend/src/modules/catalog/`, frontend da fonte de dados e contratos.
  - Verificar: testes de contrato, IDs, URLs, maturidade e abas.
- [ ] **T3 (P1, human: ~2 dias / Codex: ~3h)** — Preview — Separar transporte, parser e layout e impor limites.
  - Origem: o controller atual seleciona parser por branches e o fetch acumula todo o arquivo sem teto de bytes.
  - Arquivos: módulo de preview, fetcher, parsers e testes.
  - Verificar: URL/redirect/payload inválidos e todos os formatos atuais.
- [ ] **T4 (P1, human: ~1 semana / Codex: ~1 dia)** — Legislativo — Executar o vertical slice da Câmara descrito em `codex-review1.plan.md`.
  - Origem: primeiro domínio normalizado continua sem implementação.
  - Arquivos: integrations/camara, domains/shared, domains/legislative, database e API.
  - Verificar: replay, idempotência, reconciliação, proveniência e E2E.
- [ ] **T5 (P2, human: ~2 dias / Codex: ~3h)** — Operação — Medir preview e freshness.
  - Origem: dependência atual da disponibilidade do órgão durante o preview.
  - Arquivos: métricas/logs do backend e UI de estado.
  - Verificar: timeout, origem fora do ar, cache e atraso são observáveis.
- [ ] **T6 (P3, human: ~2 dias / Codex: ~3h)** — Arquitetura — Revisar o shared kernel depois do segundo domínio.
  - Origem: evitar abstrações baseadas apenas no Legislativo.
  - Arquivos: ADRs e domains/shared.
  - Verificar: toda entidade compartilhada tem dois consumidores com a mesma semântica.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Escopo e estratégia | 0 | Não executada | Fora desta revisão |
| Codex Review | pedido direto | Evolução após roadmap | 2 | Concluída | princípios preservados, 6 mudanças estruturais |
| Eng Review | `/plan-eng-review` | Arquitetura e testes | 2 | Issues open | 4 decisões abertas, 0 gaps silenciosos aceitos |
| Design Review | `/plan-design-review` | UI/UX | 0 | Não executada | Não altera o desenho visual nesta fase |
| DX Review | `/plan-devex-review` | Experiência de desenvolvimento | 0 | Não executada | Registry deverá ser documentado no T2 |

**VERDICT:** ARQUITETURA-BASE PRESERVADA; EVOLUIR PARA SOURCE REGISTRY + SHARED KERNEL + BOUNDED DOMAINS ANTES DE ESCALAR AS INTEGRAÇÕES.

**UNRESOLVED DECISIONS:**

- Confirmar Câmara/votos como primeiro domínio normalizado.
- Definir a política inicial de cache do preview.
- Escolher o segundo domínio depois do Legislativo.
- Confirmar que o registry permanece versionado em código até surgir necessidade editorial de banco.
