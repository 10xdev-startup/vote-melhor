---
name: Login e autenticacao com Supabase (email + senha)
overview: Traz o fluxo de auth do 10x-mkt adaptado ao 10xGov — funda a tabela users, cria /login, /cadastro e /seja-bem-vindo, e protege a area logada no proxy.ts.
todos: []
isProject: false
---

# `Login e autenticacao com Supabase (email + senha)`

---

## Problema

O 10xGov tem toda a infraestrutura de auth pronta e **nenhum jeito de logar**:

- `backend/src/middleware/supabaseMiddleware.ts` valida Bearer JWT e injeta `req.user`;
  `UserController` expoe `/users/me`, `/users/onboard`, `PATCH /users/me`.
- `frontend/services/apiClient.ts` ja anexa `Authorization: Bearer` da sessao Supabase.
- `frontend/services/userService.ts` ja tem `onboard()`; `types/user.ts` ja tem `onboardedAt`.

Mas faltam as tres pontas que fecham o circuito:

1. **`public.users` nao existe no Supabase** — so o schema `auth` esta populado. Todo
   endpoint de usuario responderia erro de tabela inexistente.
2. **Nao ha telas de entrada** — sem `/login`, sem `/cadastro`, sem sessao no cliente.
3. **Nao ha gate de rotas** — `frontend/proxy.ts` so atualiza cookie de sessao; `/inicio`
   e `/componentes` estao abertos a qualquer visitante.

---

## Solucao

Portar o fluxo do 10x-mkt (`frontend/app/login`, `register`, `seja-bem-vindo`,
`hooks/useAuth.tsx`, `lib/authRedirect.ts`, `middleware.ts`) adaptado a tres decisoes deste
projeto:

- **So email + senha.** Sem Google OAuth (`external_google_enabled` ja esta `false` no
  projeto), logo **sem `/auth/callback`** — o unico consumidor daquela rota era o OAuth.
- **`mailer_autoconfirm` ligado.** O `signUp` devolve sessao na hora; sem SMTP proprio, o
  mailer embutido do Supabase (~2 emails/hora) travaria o cadastro. Trocar depois = 1 flag
  + recriar a rota de callback.
- **`/seja-bem-vindo` nao coleta dado.** No 10x-mkt ela pede WhatsApp obrigatorio; aqui so
  apresenta a plataforma e a CTA chama `POST /users/onboard` (marca `onboarded_at`). A
  fundacao `users` nao ganha coluna `phone`.

Rotas em portugues, seguindo `/inicio` que o projeto ja usa: **`/login`**, **`/cadastro`**,
**`/seja-bem-vindo`**.

---

## Checklist resumida

```
Fase 0: funda public.users no Supabase + liga mailer_autoconfirm
Fase 1: base do cliente — authRedirect, authService, useAuth (+ teste do open redirect)
Fase 2: telas /login e /cadastro
Fase 3: /seja-bem-vindo (Server Component + view)
Fase 4: gate de rotas no proxy.ts, AuthProvider no layout, Sair na sidebar, Entrar na landing
Fase 5: smoke test (typecheck + lint + testes pertinentes + E2E manual)
```

---

## Passo a passo

### Fase 0 — `Fundacao no Supabase`

**Objetivo:** `public.users` existente com RLS/trigger, e cadastro por email entrando direto.

1. Aplicar o SQL de `.claude/skills/supabase/fundacao.md` via Management API — dry-run com
   `rollback`, depois `commit`. Nada de arquivo `.sql` no repo.
2. `PATCH /v1/projects/{ref}/config/auth` com `mailer_autoconfirm: true`.

**Validacao parcial:** `information_schema.columns` lista as 9 colunas; `pg_policies` mostra
`users_select_own` e `users_update_own`; `config/auth` retorna `mailer_autoconfirm=true`.

**Commit sugerido:** `chore(supabase): funda a tabela users e liga o autoconfirm de email`

---

### Fase 1 — `Base do cliente`

**Objetivo:** sessao Supabase disponivel em React e destino pos-login a prova de open redirect.

1. Em `frontend/lib/authRedirect.ts` → criar `normalizeRedirectTarget` (fallback `/inicio`,
   rejeita externo e as rotas do proprio fluxo) e `welcomeHref`.
2. Em `frontend/tests/authRedirect.test.ts` → portar o teste do 10x-mkt com as rotas daqui.
3. Em `frontend/services/authService.ts` → `signInWithEmail`, `signUpWithEmail`, `signOut`
   sobre `lib/supabase/client`. Fora do barrel `services/index.ts`: auth fala com o SDK do
   Supabase, nao com o `apiClient` (o barrel e so dominio HTTP).
4. Em `frontend/hooks/useAuth.tsx` → `AuthProvider` + `useAuth` expondo `user`, `isLoading`,
   `isAuthenticated`, `login`, `register`, `logout`.

**Validacao parcial:** `npm test -w frontend -- tests/authRedirect.test.ts` + `typecheck`.

**Commit sugerido:** `feat(auth): adiciona sessao Supabase e destino seguro pos-login`

---

### Fase 2 — `Telas de entrada`

**Objetivo:** entrar e criar conta por email e senha.

1. Em `frontend/app/login/page.tsx` → form email/senha, `?redirect=` preservado, link pro
   cadastro. Sem botao de Google.
2. Em `frontend/app/cadastro/page.tsx` → nome, email, senha (minimo 6, igual ao
   `password_min_length` do projeto); no sucesso vai pra `welcomeHref(destino)`.

**Validacao parcial:** `typecheck` + `lint`; criar conta no dev e chegar em `/seja-bem-vindo`.

**Commit sugerido:** `feat(auth): cria as telas de login e cadastro por email`

---

### Fase 3 — `Primeiro acesso`

**Objetivo:** `/seja-bem-vindo` mostrada uma vez, com CTA que fecha o onboarding.

1. Em `frontend/app/seja-bem-vindo/page.tsx` → Server Component: exige sessao, le
   `onboarded_at` e redireciona pro destino se ja concluido (F5/voltar nao repetem a tela).
2. Em `frontend/app/seja-bem-vindo/SejaBemVindoView.tsx` → apresentacao + CTA chamando
   `userService.onboard()` e seguindo pro destino.

**Validacao parcial:** `typecheck` + `lint`; F5 na tela apos concluir cai em `/inicio`.

**Commit sugerido:** `feat(auth): adiciona a tela de boas-vindas do primeiro acesso`

---

### Fase 4 — `Gate e navegacao`

**Objetivo:** area logada fechada e caminho de UI completo (entrar e sair).

1. Em `frontend/proxy.ts` → manter o refresh de cookie e adicionar o gate: publicas `/`,
   `/login`, `/cadastro` e `/lp/*`; resto exige sessao (`?redirect=` com o destino); logado
   em `/login` ou `/cadastro` vai pro `/inicio`. Cookies do refresh preservados no redirect.
2. Em `frontend/app/layout.tsx` → montar `AuthProvider`.
3. Em `frontend/components/AppSidebar.tsx` → item "Sair" no footer.
4. Em `frontend/app/page.tsx` → link "Entrar" no topo da landing (hoje nao existe nenhum
   caminho de UI ate o login).

**Validacao parcial:** `/inicio` deslogado cai em `/login?redirect=%2Finicio`; logado em
`/login` cai em `/inicio`; Sair volta pra landing.

**Commit sugerido:** `feat(auth): protege a area logada e liga entrar/sair na navegacao`

---

### Fase 5 — `Smoke test`

**Objetivo:** provar o fluxo inteiro antes de declarar feito.

1. `npm run typecheck -w backend` + `npm run lint -w backend`.
2. `npm run typecheck -w frontend` + `npm run lint -w frontend`.
3. `npm test -w frontend -- tests/authRedirect.test.ts`.
4. **E2E:** cadastro → `/seja-bem-vindo` → CTA → `/inicio` → Sair → `/login` → entrar →
   `/inicio`.
5. **Edge case:** abrir `/componentes` deslogado → login → cair em `/componentes` (deep link
   preservado); `?redirect=https://evil.com` → `/inicio`.

**Commit sugerido:** `chore(auth): fecha o fluxo de login com o smoke test`

---

## Diagrama

### Atual

```
Browser ──► app/page.tsx (/)              (existente, sem link de entrada)
        ──► app/(dashboard)/inicio        (existente, ABERTO a qualquer visitante)
        ──► proxy.ts                      (existente, so refresca cookie)

apiClient ──► Authorization: Bearer ──► backend /users/*  (existente)
                                          │
                                          ▼
                                   public.users  ✗ NAO EXISTE
```

### Desejado

```
                        ┌──────────────────────────────────────┐
                        │ lib/authRedirect.ts        ✨ NOVO   │
                        │ normalizeRedirectTarget(raw): string │
                        │ welcomeHref(destino): string         │
                        └──────────────────────────────────────┘
                                   ▲            ▲
                                   │            │
Browser ──► app/page.tsx (/)  ── "Entrar" ──►  app/login          ✨ NOVO
                                               app/cadastro       ✨ NOVO
                                                    │
                                                    │ signUp/signIn (SDK)
                                                    ▼
                                        services/authService.ts   ✨ NOVO
                                                    │
                                                    ▼
                                        hooks/useAuth.tsx         ✨ NOVO
                                        (AuthProvider no layout)
                                                    │
        ┌───────────────────────────────────────────┘
        ▼
  app/seja-bem-vindo  ✨ NOVO ── CTA ──► userService.onboard() ──► POST /users/onboard (existente)
        │                                                                  │
        │ ja tem onboarded_at? ──► redireciona                             ▼
        ▼                                                          public.users  ✨ NOVO
  app/(dashboard)/inicio (existente)                               (RLS + trigger handle_new_user)
        ▲
        │ sessao valida
  proxy.ts  ◄── gate de rotas ✨ (publicas: / /login /cadastro /lp/*)

  app/auth/callback  ✂ NAO PORTADO — so existia para o OAuth do 10x-mkt
```
