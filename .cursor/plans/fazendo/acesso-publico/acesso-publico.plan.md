---
name: Acesso publico a leitura dos dados
overview: Abre /inicio, /camara, /senado e /fonte-de-dados a visitante, abre os GETs de dado factual no backend e troca o "Entrar" do topo da landing por CTAs a cada quebra de secao.
todos: []
isProject: false
---

# `Acesso publico a leitura dos dados`

---

## Problema

Os dados do Congresso ja sao publicos na origem, mas a Vote Melhor exige cadastro para ver
qualquer um deles. Tres sintomas:

1. **O gate cobre tudo.** `frontend/proxy.ts:12` libera so `/`, `/login`, `/cadastro` e
   `/lp/*`. Todo o grupo `(dashboard)` — incluindo o hub `/inicio` e as tres telas de dado —
   redireciona para `/login`.
2. **A API tambem esta fechada.** As 6 routers de dado aplicam `supabaseMiddleware`, apesar
   de serem **100% GET** e de **nenhum controller delas usar `req.user`** (so o
   `UserController` usa). Cinco delas ja carregam um comentario dizendo que a abertura viria
   depois — a decisao estava tomada, faltava executar.
3. **A porta de entrada esta escondida.** O unico caminho para dentro do produto e um
   "Entrar" discreto no canto superior direito da landing (`frontend/app/page.tsx:42-49`),
   depois de 6 secoes de conteudo sem nenhuma chamada para acao.

Isso contradiz o principio declarado no `CLAUDE.md` — *"Open source e API aberta: todo dado
exposto na UI deve estar acessivel tambem via API"* — e cobra cadastro por dado que o governo
ja publica aberto.

---

## Solucao

Separar **leitura** de **acao com conta**:

- **Leitura publica** — hub, as tres telas de dado e os GETs factuais abrem a visitante.
- **Conta** — continua existindo para o que depende de usuario (`/users/*`,
  `/seja-bem-vindo`, `/componentes`) e para as acoes que vierem a exigir identidade.

Na landing, o "Entrar" sai do topo e cada quebra de secao ganha uma CTA de acesso apontando
para `/inicio`. O link de conta migra para o rodape da sidebar, que passa a mostrar
**"Entrar"** sem sessao e **"Sair"** com sessao — hoje mostra "Sair" para todo mundo,
inclusive para quem nunca logou.

A decisao de quais rotas sao publicas sai do `proxy.ts` e vira `lib/publicRoutes.ts`, uma
funcao pura e testada: e o ponto onde um engano silencioso abriria rota privada.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
Visitante
     │
     ▼
frontend/proxy.ts                               (existente)
     │   PUBLIC_PATHS = ['/', '/login', '/cadastro']
     │   PUBLIC_PREFIXES = ['/lp/']
     │
     ├─ /inicio          ──► redirect /login    ◄── hub bloqueado
     ├─ /camara          ──► redirect /login
     ├─ /senado          ──► redirect /login
     └─ /fonte-de-dados  ──► redirect /login

backend/src/routes/*.ts                         (existente)
     └─ router.use(supabaseMiddleware)          ◄── nas 6 routers de dado, todas so GET
            │                                       e nenhuma usa req.user
            ▼
        401 para visitante

frontend/app/page.tsx                           (existente)
     ├─ header ──► "Entrar"                     ◄── unica porta, no canto superior direito
     └─ 6 secoes de conteudo                    ◄── nenhuma CTA ate o fim da pagina
```

### Desejado

```text
Visitante
     │
     ▼
frontend/lib/publicRoutes.ts                    ✨ NOVO — decisao de rota publica (~25 linhas)
     ├─ PUBLIC_PATHS      = ['/', '/login', '/cadastro', '/inicio',
     │                       '/camara', '/senado', '/fonte-de-dados']
     ├─ PUBLIC_PREFIXES   = ['/lp/']
     └─ isPublicPath(pathname): boolean         ◄── funcao pura, testada
            ▲
            │ importa
frontend/proxy.ts                               (existente — perde a decisao, mantem o gate)
     │
     ├─ /inicio          ──► 200                ◄── hub aberto
     ├─ /camara          ──► 200
     ├─ /senado          ──► 200
     ├─ /fonte-de-dados  ──► 200
     ├─ /seja-bem-vindo  ──► redirect /login    ◄── continua privada
     └─ /componentes     ──► redirect /login    ◄── continua privada

backend/src/routes/                             (existente — perde o middleware)
     ├─ deputyRoutes.ts             ✂ router.use(supabaseMiddleware)
     ├─ senatorRoutes.ts            ✂ router.use(supabaseMiddleware)
     ├─ votacaoRoutes.ts            ✂ router.use(supabaseMiddleware)
     ├─ camaraVotingRoutes.ts       ✂ router.use(supabaseMiddleware)
     ├─ dataCatalogRoutes.ts        ✂ router.use(supabaseMiddleware)
     ├─ legislativeJourneyRoutes.ts ✂ router.use(supabaseMiddleware)
     └─ userRoutes.ts               (existente — MANTEM, e a unica que usa req.user)

     ┌─────────────────────────────────────────────────────────────────┐
     │ Contrato de acesso da API                                       │
     │   GET /deputies /senators /votacoes                             │
     │   GET /camara/votacoes /data-sources /legislative-journeys      │
     │     ─ publicos, sem Authorization                               │
     │     ─ envelope wrapped inalterado; controller e model intactos  │
     │                                                                 │
     │   /users/*  ─ continua exigindo Bearer (injeta req.user)        │
     └─────────────────────────────────────────────────────────────────┘

frontend/app/page.tsx                           (existente — perde o header, ganha CTAs)
     ├─ header com "Entrar"                     ✂ DELETADO
     └─ AccessCta                               ✨ NOVO — componente local da pagina
           ├─ ao fim do hero          (tone claro)
           ├─ ao fim de "O problema"  (tone claro)
           ├─ ao fim de "Como funciona"
           ├─ ao fim de "Escopo"
           ├─ ao fim de "Principios"
           └─ ao fim do bloco final   (tone escuro)
                 └─ href="/inicio" + "sem cadastro" ◄── deixa explicito que nao pede login

frontend/components/AppSidebar.tsx              (existente — ganha estado de sessao)
     └─ rodape: useAuth()
           ├─ sem sessao ──► "Entrar"  ──► /login   ✨ NOVO
           └─ com sessao ──► "Sair"    (existente)
```

> Convencoes de notacao e dicas de uso: [diagrama-arquitetura.template.plan.md](../../templates/diagrama-arquitetura.template.plan.md).

---

## Mapa de arquivos

```text
Mapa de arquivos
================================================================================
BACKEND / backend/src/
================================================================================

Routes                                     6 arquivos, 81 linhas
  routes/deputyRoutes.ts [M]                 15 linhas | remove gate; GET / e /:id
  routes/senatorRoutes.ts [M]                14 linhas | remove gate; GET / e /:code
  routes/votacaoRoutes.ts [M]                14 linhas | remove gate; GET / e /:id
  routes/camaraVotingRoutes.ts [M]           13 linhas | remove gate; GET / e /:id
  routes/dataCatalogRoutes.ts [M]            15 linhas | remove gate; catalogo e preview
  routes/legislativeJourneyRoutes.ts [M]     10 linhas | remove gate; GET /:id

--------------------------------------------------------------------------------
Nao tocados (fora do escopo)
  routes/userRoutes.ts [B]                   18 linhas | mantem gate; unica que usa req.user
  controllers/ models/ [B]                              nenhuma mudanca: so o acesso muda

================================================================================
FRONTEND / frontend/
================================================================================

Gate de rotas                              2 arquivos, ~95 linhas
  lib/publicRoutes.ts [N]                   ~25 linhas | PUBLIC_PATHS + isPublicPath
    -> consumido por proxy.ts
  proxy.ts [M]                               70 linhas | mantem sessao e redirect; importa a decisao

--------------------------------------------------------------------------------
Telas                                      2 arquivos, 489 linhas
  app/page.tsx [M]                          263 linhas | remove header; AccessCta a cada quebra
  components/AppSidebar.tsx [M]             226 linhas | rodape Entrar/Sair por sessao

--------------------------------------------------------------------------------
Tests / frontend/tests/                    1 arquivo, ~40 linhas
  publicRoutes.test.ts [N]                  ~40 linhas | publica abre, privada nao vaza
  authRedirect.test.ts [B]                   72 linhas | inalterado: destino pos-login segue /inicio
================================================================================
```

---

## Checklist resumida

```
Fase 1: backend abre os GETs factuais — remove supabaseMiddleware de 6 routers
Fase 2: frontend abre as rotas — lib/publicRoutes.ts + proxy.ts + teste
Fase 3: sidebar mostra Entrar sem sessao e Sair com sessao
Fase 4: landing perde o "Entrar" do topo e ganha CTA a cada quebra
Fase 5: smoke test
```

---

## Passo a passo

### Fase 1 — `backend abre a leitura`

**Objetivo:** os 6 grupos de rota de dado respondem 200 sem `Authorization`.

**Contrato travado:** `/users/*` continua exigindo Bearer — e a unica familia que le
`req.user`. Abrir rota de dado nunca significa abrir rota de usuario. Nenhum controller ou
model e tocado: a mudanca e exclusivamente de acesso, entao o envelope wrapped e o shape das
respostas permanecem identicos.

**Reaproveita:** `backend/src/routes/dataCatalogRoutes.ts:7-9` — o comentario ja descreve a
operacao exata ("abrir estas rotas depois e remover esta linha, sem tocar em controller nem
model"); o mesmo par comentario+linha se repete em `senatorRoutes.ts:7-9`,
`votacaoRoutes.ts:7-9`, `deputyRoutes.ts:7-9` e `camaraVotingRoutes.ts:7-8`.

1. Em `backend/src/routes/{deputy,senator,votacao,camaraVoting,dataCatalog,legislativeJourney}Routes.ts`
2. Remover `router.use(supabaseMiddleware)`, o `import { supabaseMiddleware }` que fica sem
   uso e o comentario que anunciava a abertura.
3. Trocar o comentario por uma linha curta declarando a rota publica e o porque.

**Validacao parcial:** `curl -s localhost:3001/deputies | head -c 200` retorna envelope com
`success:true` sem header de auth; `curl -s -o /dev/null -w '%{http_code}' localhost:3001/users/me`
continua `401`.

**Commit sugerido:** `feat(acesso-publico): backend - abre a leitura dos dados factuais`

---

### Fase 2 — `gate de rotas do frontend`

**Objetivo:** visitante abre `/inicio`, `/camara`, `/senado` e `/fonte-de-dados` sem redirect.

**Contrato travado:** `/seja-bem-vindo` e `/componentes` continuam privadas. A lista e de
**paths exatos** mais um conjunto separado de prefixos — nunca transformar um path em prefixo
por conveniencia, porque `/` como prefixo abriria o app inteiro.

**Reaproveita:** `frontend/proxy.ts:19-21` — `isPublicPath` ja existe com a forma final
(path exato + prefixo); a fase move a funcao para `lib/`, nao a reescreve. O padrao de util
sem HTTP em `lib/` segue `frontend/lib/authRedirect.ts`.

1. Em `frontend/lib/publicRoutes.ts` (novo) → mover `PUBLIC_PATHS`, `PUBLIC_PREFIXES` e
   `isPublicPath`, acrescentando as quatro rotas de leitura.
2. Em `frontend/proxy.ts` → importar `isPublicPath` e apagar as definicoes locais.

**Cenarios obrigatorios:**

| Cenario | Resultado obrigatorio |
|---|---|
| `/inicio`, `/camara`, `/senado`, `/fonte-de-dados` | `isPublicPath` retorna `true` |
| `/seja-bem-vindo`, `/componentes` | retorna `false` |
| `/lp/qualquer-campanha` | retorna `true` (prefixo) |
| `/camara-secreta`, `/inicio-admin` | retorna `false` — path exato nao vira prefixo |
| `/camara?aba=pautas` | `false`: a funcao recebe `pathname`, que nunca traz query |

**Validacao parcial:** `npm test -w frontend -- tests/publicRoutes.test.ts`.

**Commit sugerido:** `feat(acesso-publico): frontend - abre as rotas de leitura no gate`

---

### Fase 3 — `entrar e sair na sidebar`

**Objetivo:** o rodape da sidebar reflete a sessao real.

**Contrato travado:** o "Sair" continua fazendo full reload via `window.location.assign('/')`
— o gate do `proxy.ts` precisa reavaliar a rota sem os cookies e o Router Cache do Next nao
pode servir a area logada a partir do cache.

**Reaproveita:** `frontend/components/AppSidebar.tsx:124` — `useAuth()` ja esta no componente,
usado so para o tooltip do email; a fase passa a usar `isLoading`/`user` para decidir o item.
`frontend/hooks/useAuth.tsx:22` ja expoe `isLoading` exatamente para nao piscar o estado
deslogado antes da sessao carregar.

1. Em `frontend/components/AppSidebar.tsx` → ler `{ user, isLoading }`; enquanto `isLoading`,
   manter o item neutro; sem sessao, renderizar "Entrar" navegando para `/login`.

**Validacao parcial:** abrir `/inicio` deslogado → rodape mostra "Entrar"; logar → mostra
"Sair" com o email no tooltip.

**Commit sugerido:** `feat(acesso-publico): frontend - sidebar alterna entrar e sair`

---

### Fase 4 — `CTA de acesso na landing`

**Objetivo:** cada quebra de secao oferece a entrada; o topo nao tem mais "Entrar".

**Contrato travado:** a CTA aponta para `/inicio` e diz explicitamente que nao exige
cadastro. Nenhuma CTA da landing leva a `/login`: a porta de conta e a sidebar.

**Reaproveita:** `frontend/app/page.tsx:250-258` — o botao do GitHub ja define a forma do
CTA na secao escura (pill, `gap-2.5`, `px-5 py-3`, `text-sm font-semibold`); o componente
novo segue a mesma medida para nao criar um segundo vocabulario visual. As cores ja sao
tokens repetidos na pagina: `#315bff` (acao) e `#d9ff70` (destaque no escuro).

1. Em `frontend/app/page.tsx` → remover o `<header>` com o link `/login`.
2. Criar o componente local `AccessCta({ tone })` com as duas variantes (claro/escuro).
3. Inserir a CTA ao fim do hero e de cada uma das 5 secoes seguintes.

**Validacao parcial:** rolar a landing e encontrar a CTA em toda quebra; nenhum "Entrar" no
topo; clicar leva a `/inicio` sem passar por login.

**Commit sugerido:** `feat(acesso-publico): frontend - CTA de acesso a cada secao da landing`

---

### Fase final — Validacao (smoke test)

- Conferir o Mapa de arquivos contra os caminhos finais; atualizar estados e contagens.
- `npm run typecheck -w backend` → 0 erros.
- `npm run lint -w backend` → 0 erros.
- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Testes Jest PERTINENTES: `npm test -w frontend -- tests/publicRoutes.test.ts` e
  `npm test -w frontend -- tests/authRedirect.test.ts`.
- Reinicia backend (`npm run dev -w backend`).
- **E2E:** em aba anonima, abrir `/` → clicar em qualquer CTA → cair em `/inicio` sem login →
  navegar para Camara, Senado e Fonte de dados → os dados carregam.
- **Edge case:** abrir `/seja-bem-vindo` e `/componentes` deslogado → continuam redirecionando
  para `/login` com `?redirect=` preservado; logar → cair no destino original.
- **Edge case:** `GET /users/me` sem token → `401`.
