# Template 10xDev

Base full-stack para iniciar produtos com Next.js 16, React 19, Express 5, TypeScript e
Supabase. O monorepo usa npm workspaces e um único lockfile na raiz.

## Início rápido

Requer Node.js 20 ou superior e npm.

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev
```

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

## Bootstrap guiado

Use `$10x-inicio-projeto` para definir produto, identidade, rotas, ownership, variáveis e o
primeiro fluxo vertical. A fundação Supabase proposta pela skill contém somente `users` e
RLS por usuário. Tabelas de domínio nascem do briefing. A execução e a auditoria do banco são
delegadas a `$supabase`.

O `proxy.ts` base apenas renova a sessão. A skill define as rotas públicas e protegidas conforme
o briefing, sem presumir a navegação do produto.

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
