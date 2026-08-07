# 10xGov

## Visão

A **10xGov** é uma plataforma open source para tornar os dados públicos do governo brasileiro acessíveis, compreensíveis e utilizáveis por qualquer pessoa.

Hoje, milhares de informações sobre o funcionamento do governo já são públicas: votações, projetos de lei, discursos, gastos, presença de parlamentares, eleições, emendas, licitações e muito mais. Porém, esses dados estão espalhados em diferentes órgãos, possuem formatos complexos e exigem conhecimento técnico para serem consultados.

A missão da 10xGov é transformar esses dados em respostas simples, verificáveis e baseadas em fontes oficiais.

---

## Problema

Os dados existem, mas são difíceis de consumir.

Para responder perguntas como:

- Como meu deputado votou nos últimos anos?
- Quem votou a favor desta lei?
- Quais parlamentares costumam votar juntos?
- Quais projetos impactam determinado tema?
- O que esta PEC realmente faz?
- Quanto determinado parlamentar gastou?
- Como um projeto caminhou até ser aprovado?

Normalmente é necessário consultar diversos portais públicos, interpretar documentos legislativos e entender o funcionamento do processo político.

---

## Solução

A 10xGov unifica dados oficiais provenientes de diferentes órgãos governamentais e utiliza Inteligência Artificial para organizá-los, relacioná-los e explicá-los em linguagem simples.

O objetivo não é produzir opinião política, mas facilitar o acesso à informação pública.

Toda resposta deve ser baseada em dados oficiais, com links para as fontes originais.

---

## Princípios

- Dados oficiais como única fonte de verdade
- Transparência total sobre a origem das informações
- Neutralidade política
- Explicações em linguagem simples
- Código aberto
- APIs abertas para desenvolvedores
- Arquitetura modular
- IA como ferramenta de compreensão, não de opinião

---

## Público

- Cidadãos
- Jornalistas
- Pesquisadores
- Estudantes
- Desenvolvedores
- Organizações da sociedade civil
- Empresas interessadas em inteligência regulatória
- Universidades

---

## Funcionalidades previstas

### Parlamento

- Deputados e Senadores
- Histórico de votações
- Projetos de lei
- PECs
- Medidas Provisórias
- Comissões
- Discursos
- Presença em sessões
- Gastos parlamentares
- Emendas

### Busca Inteligente

Perguntas em linguagem natural como:

> Como o deputado X votou sobre impostos?

> Quem mais vota parecido com o senador Y?

> Explique esta PEC em linguagem simples.

> Quais projetos tratam sobre Inteligência Artificial?

---

### IA

- Resumos automáticos
- Explicação de termos jurídicos
- Linha do tempo de tramitação
- Comparação entre parlamentares
- Agrupamento por temas
- Similaridade de votos
- Respostas com citações das fontes oficiais

---

### APIs

A 10xGov pretende disponibilizar uma API unificada sobre dados públicos brasileiros.

Exemplo:

```ts
const deputado = await gov.deputado(id)

const votos = await deputado.votos()

const resumo = await deputado.resumirVotacoes()
```

ou

```ts
const resposta = await gov.ask(
  "Quem votou a favor da Reforma Tributária?"
)
```

---

## Fontes de Dados

Inicialmente:

- Câmara dos Deputados
- Senado Federal

Futuramente:

- TSE
- Portal da Transparência
- Diário Oficial da União
- Compras.gov
- Dados Abertos do Governo Federal
- IBGE
- IPEA
- Tesouro Nacional
- STF
- STJ
- Tribunais de Contas

---

## Arquitetura

```
          APIs Oficiais
                │
      ┌─────────┴─────────┐
      │                   │
 Câmara            Senado
      │                   │
      └─────────┬─────────┘
                │
         Normalização
                │
          Banco de Dados
                │
        Índice Semântico
                │
      Inteligência Artificial
                │
        API + Interface Web
```

---

## Objetivo de longo prazo

Ser a principal infraestrutura aberta para dados governamentais brasileiros, permitindo que qualquer pessoa ou organização compreenda o funcionamento do Estado por meio de dados públicos, IA e APIs abertas.

Assim como o GitHub democratizou o acesso ao código e o Stripe simplificou pagamentos, a 10xGov busca simplificar o acesso aos dados públicos brasileiros.

---

## Stack

Next.js 16, React 19, Express 5, TypeScript e Supabase. O monorepo usa npm workspaces e um
único lockfile na raiz.

## Início rápido

Requer Node.js 20 ou superior e npm.

```bash
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev
```

O backend precisa de um `backend/.env` com `PORT`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF` e
`SUPABASE_ACCESS_TOKEN`. Os valores saem do painel do Supabase em Settings → API.

Preencha os dois envs locais antes de testar autenticação ou banco. O backend continua
respondendo em `/health` sem credenciais, mas rotas que acessam o Supabase exigem configuração.

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:3001>
- Health: <http://localhost:3001/health>

## Scripts da raiz

```bash
npm run dev        # frontend e backend simultaneamente
npm run typecheck  # TypeScript dos dois workspaces
npm run lint       # ESLint dos dois workspaces
npm run build      # build dos dois workspaces
```

## Estrutura

```text
backend/src/
├── controllers/   HTTP e orquestração curta
├── models/        único acesso ao Supabase
├── routes/        paths e middleware
├── middleware/    auth, papéis e erros do Express
├── types/
├── utils/
└── database/supabase.ts

frontend/
├── app/            uma rota por recurso
├── components/     UI compartilhada e de domínio
├── services/       chamadas pelo apiClient
├── types/
├── lib/supabase/   clients browser e server
└── proxy.ts        atualização da sessão Supabase no Next.js
```

O backend segue Routes → Controller → Model → Database. Controllers respondem pelo envelope
`sendOk`/`sendError`; nunca use `res.json` cru. No frontend, chamadas HTTP passam pelo
`apiClient`, que desembrulha o envelope uma vez.

## Deploy

O workflow Azure vem com placeholders `seu-*` e falha fechado até ser configurado. Depois do
fluxo local, use `$deploy-azure` para escolher nomes/SKUs, configurar os recursos e validar
health, CORS, callbacks e secrets do GitHub.

Os Dockerfiles usam o lockfile raiz e devem ser construídos com a raiz do monorepo como contexto:

```bash
docker build --file backend/Dockerfile .
docker build --file frontend/Dockerfile .
```

Nenhum `.env` real, chave de service role ou token de Management API deve ser versionado.
